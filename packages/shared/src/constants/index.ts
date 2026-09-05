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

/** Gemini model used for both generation calls; override with MODEL. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

export const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta";
