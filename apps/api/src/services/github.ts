import {
  DOC_FILES,
  GITHUB_API_BASE,
  GOOD_FIRST_ISSUE_LABEL,
  MANIFEST_FILES,
  MAX_FILE_CHARS,
  MAX_ISSUES_PER_REPO,
  MAX_MANIFEST_FILES,
  MAX_TREE_ENTRIES,
  daysSince,
  friendlinessScore,
  issueId,
  repoId,
  truncate,
} from "@repo/shared";
import type {
  Issue,
  IssueListSource,
  IssueSummary,
  Repo,
  RepoRef,
} from "@repo/shared/types";
import { env } from "../env.js";
import { HttpError } from "../lib/errors.js";

interface GitHubRepoResponse {
  default_branch: string;
  language: string | null;
}

interface GitHubIssueResponse {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  comments: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  labels: ({ name: string } | string)[];
  assignee: unknown;
  pull_request?: unknown;
}

interface GitHubTreeResponse {
  tree: { path: string; type: string }[];
  /** GitHub caps the tree response; it says so rather than paginating. */
  truncated: boolean;
}

/** Everything we read from a repo to generate an overview or a brief (spec §6). */
export interface RepoContext {
  fileTree: string[];
  readme: string | null;
  /** Keyed by repo-relative path, e.g. `apps/api/package.json`. */
  manifests: Record<string, string>;
  /** Keyed by repo-relative path, e.g. `CONTRIBUTING.md`. */
  docs: Record<string, string>;
  /** True when GitHub cut the file tree short — the tree is partial. */
  treeTruncated: boolean;
}

export async function fetchRepo(ref: RepoRef): Promise<Repo> {
  const data = await githubRequest<GitHubRepoResponse>(
    `/repos/${ref.owner}/${ref.name}`,
  );

  return {
    id: repoId(ref),
    owner: ref.owner,
    name: ref.name,
    defaultBranch: data.default_branch,
    primaryLanguage: data.language,
    lastIndexedAt: new Date().toISOString(),
  };
}

/** The ranked issue list, and which query filled it. */
export interface ScoredIssues {
  issues: IssueSummary[];
  source: IssueListSource;
}

/**
 * Open issues for a repo, scored and sorted most-approachable first (US-2).
 *
 * Asks GitHub for GOOD_FIRST_ISSUE_LABEL first. Unfiltered, the endpoint only
 * returns the newest MAX_ISSUES_PER_REPO issues, so on a busy repo older
 * labelled issues never made the list. Repos that don't use the label fall
 * back to their most recent open issues rather than an empty page.
 */
export async function fetchScoredIssues(ref: RepoRef): Promise<ScoredIssues> {
  const labelled = await fetchOpenIssues(ref, GOOD_FIRST_ISSUE_LABEL);
  if (labelled.length > 0) {
    return { issues: rankIssues(ref, labelled), source: "labelled" };
  }

  const recent = await fetchOpenIssues(ref);
  return { issues: rankIssues(ref, recent), source: "recent" };
}

async function fetchOpenIssues(
  ref: RepoRef,
  label?: string,
): Promise<GitHubIssueResponse[]> {
  const query = new URLSearchParams({
    state: "open",
    per_page: String(MAX_ISSUES_PER_REPO),
  });
  if (label) query.set("labels", label);

  const data = await githubRequest<GitHubIssueResponse[]>(
    `/repos/${ref.owner}/${ref.name}/issues?${query}`,
  );
  // The issues endpoint also returns PRs; they are not contribution targets.
  return data.filter((raw) => !raw.pull_request);
}

function rankIssues(ref: RepoRef, data: GitHubIssueResponse[]): IssueSummary[] {
  return data
    .map((raw) => toIssueSummary(ref, raw))
    .sort((a, b) => b.friendlinessScore - a.friendlinessScore);
}

/** One issue by number. Unlike the list endpoint this also finds closed ones. */
export async function fetchIssue(ref: RepoRef, number: number): Promise<Issue> {
  const raw = await githubRequest<GitHubIssueResponse>(
    `/repos/${ref.owner}/${ref.name}/issues/${number}`,
  );

  if (raw.pull_request) {
    throw new HttpError(
      "not_found",
      `#${number} is a pull request, not an issue.`,
    );
  }
  return toIssue(ref, raw);
}

// ---------------------------------------------------------------------------
// Repo contents. The whole tree in one request, then only the files we name —
// no clone and no AST parsing in v1 (spec §6).
// ---------------------------------------------------------------------------

/**
 * Every blob path in the repo at `branch`.
 *
 * `recursive=1` returns the entire tree in a single request. GitHub truncates
 * very large trees rather than paginating, so the caller is told when the
 * result is partial.
 *
 * Deliberately uncapped: MAX_TREE_ENTRIES applies to what we hand the LLM, and
 * applying it here would hide files from path selection. GitHub returns the
 * tree in sort order, so a cap drops whatever sorts last — in a Rust monorepo
 * `crates/**` alone buries the root `package.json`.
 */
export async function fetchFileTree(
  ref: RepoRef,
  branch: string,
): Promise<{ paths: string[]; truncated: boolean }> {
  const data = await githubRequest<GitHubTreeResponse>(
    `/repos/${ref.owner}/${ref.name}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
  );

  const paths = data.tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path);

  return { paths, truncated: data.truncated };
}

/**
 * The repo's README. Uses the dedicated endpoint, which resolves whatever the
 * repo actually calls it (`README`, `readme.md`, `docs/README.md`, ...).
 */
export function fetchReadme(ref: RepoRef): Promise<string | null> {
  return fetchRawFile(`/repos/${ref.owner}/${ref.name}/readme`);
}

/**
 * Manifest files present in the tree, read in parallel.
 *
 * Selecting from the tree first means one request per file that actually
 * exists, instead of a 404 for every manifest the repo does not use.
 */
export function fetchManifests(
  ref: RepoRef,
  fileTree: string[],
  branch: string,
): Promise<Record<string, string>> {
  return fetchFiles(ref, selectManifestPaths(fileTree), branch);
}

/** Contribution docs present in the tree (US-4 reads its rules out of these). */
export function fetchDocFiles(
  ref: RepoRef,
  fileTree: string[],
  branch: string,
): Promise<Record<string, string>> {
  return fetchFiles(ref, selectDocPaths(fileTree), branch);
}

/**
 * The full read for one repo. The tree has to land first — it decides which
 * files are worth requesting — after which everything else runs in parallel.
 */
export async function fetchRepoContext(
  ref: RepoRef,
  branch: string,
): Promise<RepoContext> {
  const { paths, truncated } = await fetchFileTree(ref, branch);

  // Selection runs against the whole tree; only the tree we pass on is capped.
  const [readme, manifests, docs] = await Promise.all([
    fetchReadme(ref),
    fetchManifests(ref, paths, branch),
    fetchDocFiles(ref, paths, branch),
  ]);

  return {
    fileTree: paths.slice(0, MAX_TREE_ENTRIES),
    readme,
    manifests,
    docs,
    treeTruncated: truncated || paths.length > MAX_TREE_ENTRIES,
  };
}

// ---------------------------------------------------------------------------
// Path selection. Exported because it is pure and worth testing directly.
// ---------------------------------------------------------------------------

/** Vendored and generated trees carry no signal about how the repo is built. */
const IGNORED_DIRS = [
  "node_modules",
  "vendor",
  "third_party",
  "dist",
  "build",
  ".next",
  "target",
  "fixtures",
  "__fixtures__",
  "testdata",
];

const MANIFEST_BASENAMES = new Set<string>(
  MANIFEST_FILES.map((name) => name.toLowerCase()),
);

// README is in DOC_FILES but fetchReadme already resolves it, and it is by far
// the largest of these files — matching it here would send it twice.
const DOC_PATHS = new Set<string>(
  DOC_FILES.filter((name) => name !== "README.md").map((name) =>
    name.toLowerCase(),
  ),
);

/**
 * Manifests matched by basename, so a monorepo's per-package files count too.
 * Shallowest first — the root manifest describes the project, a leaf one
 * describes a corner of it.
 */
export function selectManifestPaths(fileTree: string[]): string[] {
  return fileTree
    .filter((path) => !isIgnored(path))
    .filter((path) => MANIFEST_BASENAMES.has(basename(path).toLowerCase()))
    .sort(byDepthThenName)
    .slice(0, MAX_MANIFEST_FILES);
}

/** Docs are matched on the whole path — `CONTRIBUTING.md`, not any `*.md`. */
export function selectDocPaths(fileTree: string[]): string[] {
  return fileTree
    .filter((path) => DOC_PATHS.has(path.toLowerCase()))
    .sort(byDepthThenName);
}

/**
 * The CONTRIBUTING doc out of a fetched doc set, if the repo has one.
 *
 * Matched on basename so a repo that keeps it at `.github/CONTRIBUTING.md`
 * still resolves. Returns null rather than an empty string, because "no
 * contributing guide" is a fact the prompt should state, not a blank section.
 */
export function selectContributing(
  docs: Record<string, string>,
): string | null {
  for (const [path, content] of Object.entries(docs)) {
    if (basename(path).toLowerCase() === "contributing.md") return content;
  }
  return null;
}

function isIgnored(path: string): boolean {
  // The last segment is the filename, so only directories are considered.
  return path
    .split("/")
    .slice(0, -1)
    .some((segment) => IGNORED_DIRS.includes(segment));
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function byDepthThenName(a: string, b: string): number {
  const depth = a.split("/").length - b.split("/").length;
  return depth !== 0 ? depth : a.localeCompare(b);
}

// ---------------------------------------------------------------------------
// Transport.
// ---------------------------------------------------------------------------

function toIssue(ref: RepoRef, raw: GitHubIssueResponse): Issue {
  const labels = raw.labels.map((label) =>
    typeof label === "string" ? label : label.name,
  );

  return {
    id: issueId({ ...ref, number: raw.number }),
    repoId: repoId(ref),
    number: raw.number,
    title: raw.title,
    body: raw.body,
    labels,
    state: raw.state,
    commentCount: raw.comments,
    url: raw.html_url,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    friendlinessScore: friendlinessScore({
      labels,
      commentCount: raw.comments,
      ageInDays: daysSince(raw.created_at),
      claimed: raw.assignee != null,
    }),
  };
}

/** Only the fields an issue row shows; the full Issue is for the brief. */
function toIssueSummary(ref: RepoRef, raw: GitHubIssueResponse): IssueSummary {
  const issue = toIssue(ref, raw);
  return {
    number: issue.number,
    title: issue.title,
    url: issue.url,
    labels: issue.labels,
    commentCount: issue.commentCount,
    createdAt: issue.createdAt,
    friendlinessScore: issue.friendlinessScore,
  };
}

/** Reads several files at once, dropping any that turn out to be missing. */
async function fetchFiles(
  ref: RepoRef,
  paths: string[],
  branch: string,
): Promise<Record<string, string>> {
  const results = await Promise.all(
    paths.map(async (path) => {
      const content = await fetchRawFile(contentsPath(ref, path, branch));
      return [path, content] as const;
    }),
  );

  const found = results.filter(
    (entry): entry is readonly [string, string] => entry[1] !== null,
  );
  return Object.fromEntries(found);
}

function contentsPath(ref: RepoRef, path: string, branch: string): string {
  // Encode each segment but keep the separators — the path is part of the URL.
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `/repos/${ref.owner}/${ref.name}/contents/${encoded}?ref=${encodeURIComponent(branch)}`;
}

/**
 * File content as text. A missing file is `null` rather than an error, because
 * most repos are missing most of what we ask for and that is not a failure.
 */
async function fetchRawFile(path: string): Promise<string | null> {
  const response = await githubFetch(path, "application/vnd.github.raw");

  if (response.status === 404) return null;
  if (!response.ok) throw errorForResponse(response);

  return truncate(await response.text(), MAX_FILE_CHARS);
}

async function githubRequest<T>(path: string): Promise<T> {
  const response = await githubFetch(path, "application/vnd.github+json");

  if (!response.ok) throw errorForResponse(response);
  return (await response.json()) as T;
}

function githubFetch(path: string, accept: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "repo-onboarding-copilot",
  };
  if (env.githubToken) {
    headers.Authorization = `Bearer ${env.githubToken}`;
  }

  return fetch(`${GITHUB_API_BASE}${path}`, { headers });
}

function errorForResponse(response: Response): HttpError {
  if (response.status === 404) {
    return new HttpError(
      "not_found",
      "Repository or issue not found on GitHub.",
    );
  }
  if (response.status === 403 || response.status === 429) {
    return new HttpError(
      "rate_limited",
      "GitHub API rate limit reached. Try again shortly.",
    );
  }
  return new HttpError(
    "upstream_error",
    `GitHub API returned ${response.status}.`,
  );
}
