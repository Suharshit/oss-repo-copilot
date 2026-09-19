export type IssueState = "open" | "closed";

/** An open GitHub issue, scored for approachability at fetch time. */
export interface Issue {
  id: string;
  repoId: string;
  number: number;
  title: string;
  body: string | null;
  labels: string[];
  state: IssueState;
  commentCount: number;
  url: string;
  createdAt: string;
  updatedAt: string;
  /** Heuristic 0-1 score; not stored long-term truth. */
  friendlinessScore: number;
}

/**
 * The slice of an Issue the ranked list shows (US-2). The list endpoint
 * returns up to MAX_ISSUES_PER_REPO of these, so bodies stay out of it.
 */
export type IssueSummary = Pick<
  Issue,
  | "number"
  | "title"
  | "url"
  | "labels"
  | "commentCount"
  | "createdAt"
  | "friendlinessScore"
>;

/** How approachable an issue looks, bucketed from its friendliness score. */
export type FriendlinessTier = "great" | "good" | "tricky";

/** The inputs the friendliness heuristic runs on, kept explicit so the score is testable. */
export interface FriendlinessSignals {
  labels: string[];
  commentCount: number;
  ageInDays: number;
  /** Someone has said "I'll take this" — lowers the score. */
  claimed: boolean;
}

/**
 * Fresh-per-request LLM artifact answering "what do I actually change?" (US-3).
 * The repo's conventions travel beside it in BriefResponse rather than inside
 * it: they belong to the repo, not the issue (D-22).
 */
export interface ContributionBrief {
  id: string;
  issueId: string;
  relevantFiles: RelevantFile[];
  suggestedApproach: string;
  generatedAt: string;
}

export interface RelevantFile {
  path: string;
  reason: string;
}
