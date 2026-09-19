/** Shared between apps/web (fetch calls) and apps/api (route definitions). */
export const API_ROUTES = {
  health: "/health",
  overview: "/v1/overview",
  issues: "/v1/issues",
  brief: "/v1/brief",
} as const;

export const DEFAULT_API_PORT = 3001;
export const DEFAULT_WEB_PORT = 3000;

/** Repo overviews are cached for a week; repo structure changes slowly (spec §6). */
export const OVERVIEW_TTL_DAYS = 7;

export const GITHUB_API_BASE = "https://api.github.com";
export const GITHUB_WEB_BASE = "https://github.com";

/** Labels maintainers use to flag approachable work, highest signal first. */
export const FIRST_TIMER_LABELS = [
  "good first issue",
  "good-first-issue",
  "first-timers-only",
  "beginner friendly",
  "help wanted",
  "documentation",
  "easy",
] as const;

/**
 * The label the issue list queries GitHub by (US-2). Filtering server-side
 * reaches labelled issues of any age, not just the newest page of open ones.
 */
export const GOOD_FIRST_ISSUE_LABEL = "good first issue";

/**
 * Score cut-offs for the badge shown on each issue row. A labelled, quiet,
 * triaged issue scores 1; an unlabelled one tops out at 0.5 (see the
 * friendliness tests), so "great" effectively requires a first-timer label.
 */
export const FRIENDLINESS_TIER_THRESHOLDS = {
  great: 0.8,
  good: 0.6,
} as const;

/** Files worth reading to build an overview — no AST parsing in v1 (spec §6). */
export const MANIFEST_FILES = [
  "package.json",
  "pnpm-workspace.yaml",
  "requirements.txt",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "Gemfile",
  "composer.json",
] as const;

export const DOC_FILES = [
  "README.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "ARCHITECTURE.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
] as const;

/** Cap on how many issues we score and return for one repo. */
export const MAX_ISSUES_PER_REPO = 50;

/**
 * Caps on what one repo can contribute to a generation request. Large repos
 * would otherwise blow past the LLM's context window and cost, and the file
 * tree of a monorepo is mostly noise past the first couple of thousand paths.
 */
export const MAX_TREE_ENTRIES = 2_000;

/** Characters read from any single file; the rest is truncated away. */
export const MAX_FILE_CHARS = 40_000;

/** Manifests are matched by basename, so a monorepo can match many. */
export const MAX_MANIFEST_FILES = 10;

/**
 * Rate limits, keyed by client IP (OQ-2). There is no login (D-01), so an IP
 * is the only handle we have on a caller and this is the only abuse control
 * standing between a stranger and our Gemini bill.
 *
 * The two tiers reflect what a request actually costs: /v1/overview and
 * /v1/brief each spend one generation, plus a second for conventions when
 * they aren't cached yet (D-22).
 * /v1/issues is a GitHub read with a heuristic on top.
 */
export const GENERATION_RATE_LIMIT = {
  limit: 10,
  windowMs: 10 * 60_000,
} as const;

export const READ_RATE_LIMIT = {
  limit: 60,
  windowMs: 60_000,
} as const;

/** Gemini model used for both generation calls; override with MODEL. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

export const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta";
