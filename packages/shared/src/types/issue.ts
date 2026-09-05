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

/** The inputs the friendliness heuristic runs on, kept explicit so the score is testable. */
export interface FriendlinessSignals {
  labels: string[];
  commentCount: number;
  ageInDays: number;
  /** Someone has said "I'll take this" — lowers the score. */
  claimed: boolean;
}

/** Fresh-per-request LLM artifact answering "what do I actually change?" (US-3). */
export interface ContributionBrief {
  id: string;
  issueId: string;
  relevantFiles: RelevantFile[];
  suggestedApproach: string;
  conventionsNotes: string;
  generatedAt: string;
}

export interface RelevantFile {
  path: string;
  reason: string;
}
