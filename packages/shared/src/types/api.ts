import type { ContributionBrief, Issue, IssueSummary } from "./issue.ts";
import type { Repo, RepoConventions, RepoOverview } from "./repo.ts";

/** Every apps/api response is one of these two shapes. */
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export type ApiErrorCode =
  | "bad_request"
  | "invalid_github_url"
  | "not_found"
  | "rate_limited"
  | "upstream_error"
  | "internal_error";

// --- Route payloads ---

export interface OverviewRequest {
  /** Repo URL as pasted by the user. */
  url: string;
  /** Bypass the cached overview and regenerate. */
  refresh?: boolean;
}

export interface OverviewResponse {
  repo: Repo;
  overview: RepoOverview;
  conventions: RepoConventions | null;
  cached: boolean;
}

export interface IssuesResponse {
  repo: Repo;
  issues: IssueSummary[];
  /**
   * Which query produced `issues`: open issues labelled GOOD_FIRST_ISSUE_LABEL,
   * or — when the repo has none — its most recent open issues.
   */
  source: IssueListSource;
}

export type IssueListSource = "labelled" | "recent";

export interface BriefRequest {
  /** Issue URL as pasted by the user. */
  url: string;
}

export interface BriefResponse {
  repo: Repo;
  issue: Issue;
  brief: ContributionBrief;
  /**
   * The same conventions the overview shows, from the same cache row, so the
   * two pages can't disagree (D-22). null when the repo documents none.
   */
  conventions: RepoConventions | null;
}

export interface HealthResponse {
  status: "ok";
  service: string;
  uptimeSeconds: number;
}
