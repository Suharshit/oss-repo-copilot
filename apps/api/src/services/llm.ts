import {
  GEMINI_API_BASE,
  overviewExpiry,
  rankPathsForIssue,
  truncate,
} from "@repo/shared";
import type {
  ContributionBrief,
  Issue,
  RelevantFile,
  Repo,
  RepoConventions,
  RepoModule,
  RepoOverview,
} from "@repo/shared/types";
import { env } from "../env.js";
import { HttpError } from "../lib/errors.js";

/** Generation boundary. Every call goes to Gemini with a structured schema. */
export interface GenerationService {
  generateOverview(input: OverviewInput): Promise<RepoOverview>;
  generateBrief(input: BriefInput): Promise<ContributionBrief>;
  generateConventions(input: ConventionsInput): Promise<RepoConventions>;
}

export interface OverviewInput {
  repo: Repo;
  /** Paths from the repo file tree — no AST parsing in v1 (spec §6). */
  fileTree: string[];
  readme: string | null;
  manifests: Record<string, string>;
}

export interface BriefInput {
  repo: Repo;
  issue: Issue;
  /** The whole tree: ranked against the issue, then cut down, in the prompt. */
  fileTree: string[];
  /**
   * The repo's extracted conventions, when the cache has them. Preferred over
   * `contributing`: it is shorter, and it is what the page shows beside the
   * brief, so the approach can't contradict it (D-22).
   */
  conventions: RepoConventions | null;
  /** Raw CONTRIBUTING.md, the fallback when `conventions` is not cached yet. */
  contributing: string | null;
}

export interface ConventionsInput {
  repo: Repo;
  /** Contribution docs keyed by repo-relative path, from fetchRepoContext. */
  docs: Record<string, string>;
}

/**
 * Prompt budget. The model's context window is far larger than this, but every
 * token is paid for on each cache miss, and a 2000-path tree is mostly noise
 * after the first few hundred entries.
 */
const PROMPT_LIMITS = {
  readmeChars: 8_000,
  manifestChars: 4_000,
  treePaths: 800,
  issueBodyChars: 6_000,
  contributingChars: 6_000,
  docChars: 8_000,
} as const;

// The v1beta Schema type enum is uppercase over REST.
const OVERVIEW_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: {
      type: "STRING",
      description:
        "2-4 sentences on what the project does and who it is for. Plain language, no marketing.",
    },
    techStack: {
      type: "ARRAY",
      items: { type: "STRING" },
      description:
        "Languages, frameworks and major tools, most significant first.",
    },
    mainModules: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          path: {
            type: "STRING",
            description: "Real directory or file path from the tree provided.",
          },
          description: {
            type: "STRING",
            description: "One sentence on what lives there.",
          },
        },
        required: ["path", "description"],
      },
    },
  },
  required: ["summary", "techStack", "mainModules"],
} as const;

interface OverviewPayload {
  summary: string;
  techStack: string[];
  mainModules: RepoModule[];
}

const BRIEF_SCHEMA = {
  type: "OBJECT",
  properties: {
    relevantFiles: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          path: {
            type: "STRING",
            description:
              "Real path copied verbatim from the file tree provided. Never invent one.",
          },
          reason: {
            type: "STRING",
            description:
              "One sentence on why this file is likely to need changing for this issue.",
          },
        },
        required: ["path", "reason"],
      },
      description:
        "3-8 files, most likely to need changing first. Fewer is better than padded.",
    },
    suggestedApproach: {
      type: "STRING",
      description:
        "Plain-language steps a first-time contributor would follow. No code blocks. Mention a repo rule only where it changes a step, e.g. where tests go.",
    },
  },
  required: ["relevantFiles", "suggestedApproach"],
} as const;

interface BriefPayload {
  relevantFiles: RelevantFile[];
  suggestedApproach: string;
}

// Every field is nullable on purpose. Most repos document some of this and
// none of them document all of it, and a plausible invented rule is worse than
// an honest gap — a contributor cannot tell that "branches are named
// feat/<issue>" was never written down anywhere.
const CONVENTIONS_SCHEMA = {
  type: "OBJECT",
  properties: {
    branchNaming: {
      type: "STRING",
      nullable: true,
      description:
        "The branch naming rule, quoted or closely paraphrased. Null if the docs do not state one.",
    },
    testRequirements: {
      type: "STRING",
      nullable: true,
      description:
        "What the repo expects of tests before a PR is accepted. Null if unstated.",
    },
    lintRules: {
      type: "STRING",
      nullable: true,
      description:
        "Formatting and lint expectations, including the command to run. Null if unstated.",
    },
    prTemplate: {
      type: "STRING",
      nullable: true,
      description:
        "What the PR description must contain. Null if there is no template or checklist.",
    },
  },
  required: ["branchNaming", "testRequirements", "lintRules", "prTemplate"],
} as const;

interface ConventionsPayload {
  branchNaming: string | null;
  testRequirements: string | null;
  lintRules: string | null;
  prTemplate: string | null;
}

export const generationService: GenerationService = {
  async generateOverview(input): Promise<RepoOverview> {
    const payload = await generate<OverviewPayload>(
      buildOverviewPrompt(input),
      OVERVIEW_SCHEMA,
    );

    const generatedAt = new Date();
    return {
      id: crypto.randomUUID(),
      repoId: input.repo.id,
      summary: payload.summary,
      techStack: payload.techStack ?? [],
      // The model is asked for real paths, but it is not a search index —
      // anything it invented is dropped rather than shown to a newcomer.
      mainModules: keepRealPaths(payload.mainModules ?? [], input.fileTree),
      generatedAt: generatedAt.toISOString(),
      expiresAt: overviewExpiry(generatedAt),
    };
  },

  async generateBrief(input): Promise<ContributionBrief> {
    const payload = await generate<BriefPayload>(
      buildBriefPrompt(input),
      BRIEF_SCHEMA,
    );

    return {
      id: crypto.randomUUID(),
      issueId: input.issue.id,
      // Same guard as the overview: a path the model invented is worse than
      // no path at all, because a newcomer cannot tell the difference.
      relevantFiles: keepRealPaths(payload.relevantFiles ?? [], input.fileTree),
      suggestedApproach: payload.suggestedApproach,
      generatedAt: new Date().toISOString(),
    };
  },

  async generateConventions(input): Promise<RepoConventions> {
    const payload = await generate<ConventionsPayload>(
      buildConventionsPrompt(input),
      CONVENTIONS_SCHEMA,
    );

    return {
      repoId: input.repo.id,
      branchNaming: blankToNull(payload.branchNaming),
      testRequirements: blankToNull(payload.testRequirements),
      lintRules: blankToNull(payload.lintRules),
      prTemplate: blankToNull(payload.prTemplate),
      // Taken from what we actually read, not from the model — the sources are
      // a fact about the fetch, and asking for them invites invented filenames.
      sources: Object.keys(input.docs),
    };
  },
};

/**
 * The model answers "not stated" in prose about as often as it returns null,
 * and an empty string reads as a real value downstream. Both collapse to null.
 */
function blankToNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^(none|n\/a|not (stated|specified|documented|mentioned))\.?$/i.test(
    trimmed,
  )
    ? null
    : trimmed;
}

// ---------------------------------------------------------------------------
// Prompt construction.
// ---------------------------------------------------------------------------

function buildOverviewPrompt(input: OverviewInput): string {
  const { repo, fileTree, readme, manifests } = input;

  const sections = [
    "You are helping someone who has never seen this repository decide whether they can contribute to it.",
    "Describe only what the provided material supports. If the tech stack is not evident, list what you can see and nothing more. Never guess at a path.",
    "",
    `## Repository`,
    `${repo.owner}/${repo.name}`,
    `Default branch: ${repo.defaultBranch}`,
    `Primary language reported by GitHub: ${repo.primaryLanguage ?? "unknown"}`,
  ];

  if (readme) {
    sections.push("", "## README", truncate(readme, PROMPT_LIMITS.readmeChars));
  }

  const manifestEntries = Object.entries(manifests);
  if (manifestEntries.length > 0) {
    sections.push("", "## Manifests");
    for (const [path, content] of manifestEntries) {
      sections.push(
        `### ${path}`,
        truncate(content, PROMPT_LIMITS.manifestChars),
      );
    }
  }

  const paths = fileTree.slice(0, PROMPT_LIMITS.treePaths);
  sections.push(
    "",
    `## File tree (${paths.length} of ${fileTree.length} paths)`,
    paths.join("\n"),
  );

  return sections.join("\n");
}

function buildBriefPrompt(input: BriefInput): string {
  const { repo, issue, fileTree, conventions, contributing } = input;

  const sections = [
    "You are helping a first-time contributor work out what to change for one GitHub issue.",
    "Ground every claim in the material below. Only cite paths that appear in the file tree, copied exactly. If the issue does not say enough to locate the change, say so in the approach rather than guessing.",
    "",
    "## Repository",
    `${repo.owner}/${repo.name}`,
    `Primary language reported by GitHub: ${repo.primaryLanguage ?? "unknown"}`,
    "",
    `## Issue #${issue.number}: ${issue.title}`,
    `Labels: ${issue.labels.length > 0 ? issue.labels.join(", ") : "none"}`,
    `State: ${issue.state}`,
    "",
    issue.body
      ? truncate(issue.body, PROMPT_LIMITS.issueBodyChars)
      : "(The issue has no description.)",
  ];

  const conventionLines = conventions ? describeConventions(conventions) : [];
  if (conventionLines.length > 0) {
    sections.push("", "## Contribution rules", ...conventionLines);
  } else if (contributing) {
    sections.push(
      "",
      "## CONTRIBUTING",
      truncate(contributing, PROMPT_LIMITS.contributingChars),
    );
  } else {
    sections.push(
      "",
      "## Contribution rules",
      "(This repo documents none. Do not invent rules for it.)",
    );
  }

  // Only the head of the tree fits, so the paths sharing words with the issue
  // go first — otherwise a large repo shows the model whatever sorts first,
  // and it can't cite a file it was never shown.
  const issueText = `${issue.title}\n${truncate(issue.body ?? "", PROMPT_LIMITS.issueBodyChars)}`;
  const paths = rankPathsForIssue(fileTree, issueText).slice(
    0,
    PROMPT_LIMITS.treePaths,
  );
  sections.push(
    "",
    `## File tree (${paths.length} of ${fileTree.length} paths, those sharing words with the issue first)`,
    paths.join("\n"),
  );

  return sections.join("\n");
}

/** One "- Label: rule" line per stated rule; unstated ones are left out. */
function describeConventions(conventions: RepoConventions): string[] {
  const fields: [string, string | null][] = [
    ["Branch naming", conventions.branchNaming],
    ["Tests", conventions.testRequirements],
    ["Lint and formatting", conventions.lintRules],
    ["Pull requests", conventions.prTemplate],
  ];
  return fields.flatMap(([label, value]) =>
    value ? [`- ${label}: ${value}`] : [],
  );
}

function buildConventionsPrompt(input: ConventionsInput): string {
  const { repo, docs } = input;

  const sections = [
    "You are extracting a repository's contribution rules for someone about to open their first pull request against it.",
    "Report only rules the documents below actually state. Where a document is silent on a field, return null for it — do not infer the rule from what similar projects usually do, and do not restate a general best practice as if this repo had asked for it.",
    "",
    "## Repository",
    `${repo.owner}/${repo.name}`,
  ];

  for (const [path, content] of Object.entries(docs)) {
    sections.push("", `## ${path}`, truncate(content, PROMPT_LIMITS.docChars));
  }

  return sections.join("\n");
}

/** Drops modules whose path is not in the tree — the model does hallucinate these. */
function keepRealPaths<T extends { path: string }>(
  modules: T[],
  fileTree: string[],
): T[] {
  const known = new Set(fileTree);
  const directories = new Set<string>();
  for (const path of fileTree) {
    const segments = path.split("/");
    for (let i = 1; i < segments.length; i++) {
      directories.add(segments.slice(0, i).join("/"));
    }
  }

  return modules.filter((module) => {
    const path = module.path.replace(/\/+$/, "");
    return known.has(path) || directories.has(path);
  });
}

// ---------------------------------------------------------------------------
// Gemini transport. Structured output, so the response is parseable JSON
// rather than prose we have to scrape.
// ---------------------------------------------------------------------------

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

async function generate<T>(prompt: string, schema: unknown): Promise<T> {
  if (!env.geminiApiKey) {
    throw new HttpError(
      "internal_error",
      "GEMINI_API_KEY is not set — add it to apps/api/.env.local.",
    );
  }

  const response = await fetch(
    `${GEMINI_API_BASE}/models/${encodeURIComponent(env.model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.geminiApiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          // Descriptive work, not creative — keep it close to the source.
          temperature: 0.2,
          // Flash reasons before answering by default. This job is extraction
          // and summarisation, so the extra tokens buy little and cost real
          // money. Gemini 3 takes `thinkingLevel`; `thinkingBudget` is a 2.x
          // field and is rejected outright.
          thinkingConfig: { thinkingLevel: "low" },
        },
      }),
    },
  );

  const body = (await response.json()) as GeminiResponse;

  if (!response.ok) {
    throw errorForResponse(response.status, body);
  }

  if (body.promptFeedback?.blockReason) {
    throw new HttpError(
      "upstream_error",
      `Gemini refused the prompt (${body.promptFeedback.blockReason}).`,
    );
  }

  const candidate = body.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;

  if (!text) {
    throw new HttpError(
      "upstream_error",
      `Gemini returned no content (finishReason: ${candidate?.finishReason ?? "none"}).`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch (cause) {
    // responseSchema makes this close to impossible, so if it happens the
    // request shape is wrong, not the model.
    throw new HttpError(
      "upstream_error",
      "Gemini returned malformed JSON.",
      cause,
    );
  }
}

function errorForResponse(status: number, body: GeminiResponse): HttpError {
  const detail = body.error?.message ?? `HTTP ${status}`;

  if (status === 429) {
    return new HttpError(
      "rate_limited",
      "Gemini rate limit reached. Try again shortly.",
    );
  }
  if (status === 401 || status === 403) {
    return new HttpError(
      "internal_error",
      `Gemini rejected the API key: ${detail}`,
    );
  }
  return new HttpError("upstream_error", `Gemini error: ${detail}`);
}
