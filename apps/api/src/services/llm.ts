import { GEMINI_API_BASE, overviewExpiry, truncate } from "@repo/shared";
import type {
  ContributionBrief,
  Issue,
  Repo,
  RepoModule,
  RepoOverview,
} from "@repo/shared/types";
import { env } from "../env.js";
import { HttpError } from "../lib/errors.js";

/**
 * Generation boundary. Overview is wired to Gemini; brief is still a stub —
 * its route feeds it an empty file tree, so implementing it before that is
 * fixed would produce confident nonsense.
 */
export interface GenerationService {
  generateOverview(input: OverviewInput): Promise<RepoOverview>;
  generateBrief(input: BriefInput): Promise<ContributionBrief>;
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
  fileTree: string[];
  contributing: string | null;
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

  async generateBrief() {
    throw new HttpError(
      "internal_error",
      "Brief generation is not wired up yet (see apps/api/src/services/llm.ts).",
    );
  },
};

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

/** Drops modules whose path is not in the tree — the model does hallucinate these. */
function keepRealPaths(
  modules: RepoModule[],
  fileTree: string[],
): RepoModule[] {
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
