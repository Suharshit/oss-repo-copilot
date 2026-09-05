/** A GitHub repository the tool has seen. Source of truth, cheap to refetch. */
export interface Repo {
  id: string;
  owner: string;
  name: string;
  defaultBranch: string;
  primaryLanguage: string | null;
  lastIndexedAt: string | null;
}

/** The owner/name pair parsed out of a user-pasted URL. */
export interface RepoRef {
  owner: string;
  name: string;
}

/** Cached, regenerable LLM artifact describing a repo at a high level (US-1). */
export interface RepoOverview {
  id: string;
  repoId: string;
  summary: string;
  techStack: string[];
  mainModules: RepoModule[];
  generatedAt: string;
  expiresAt: string;
}

export interface RepoModule {
  path: string;
  description: string;
}

/** Contribution rules scraped from CONTRIBUTING.md and friends (US-4). */
export interface RepoConventions {
  repoId: string;
  branchNaming: string | null;
  testRequirements: string | null;
  lintRules: string | null;
  prTemplate: string | null;
  sources: string[];
}
