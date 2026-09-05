import {
  GITHUB_API_BASE,
  MAX_ISSUES_PER_REPO,
  daysSince,
  friendlinessScore,
  issueId,
  repoId,
} from "@repo/shared";
import type { Issue, Repo, RepoRef } from "@repo/shared/types";
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

/** Open issues for a repo, scored and sorted most-approachable first (US-2). */
export async function fetchScoredIssues(ref: RepoRef): Promise<Issue[]> {
  const data = await githubRequest<GitHubIssueResponse[]>(
    `/repos/${ref.owner}/${ref.name}/issues?state=open&per_page=${MAX_ISSUES_PER_REPO}`,
  );

  return (
    data
      // The issues endpoint also returns PRs; they are not contribution targets.
      .filter((raw) => !raw.pull_request)
      .map((raw) => toIssue(ref, raw))
      .sort((a, b) => b.friendlinessScore - a.friendlinessScore)
  );
}

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

async function githubRequest<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "repo-onboarding-copilot",
  };
  if (env.githubToken) {
    headers.Authorization = `Bearer ${env.githubToken}`;
  }

  const response = await fetch(`${GITHUB_API_BASE}${path}`, { headers });

  if (response.ok) {
    return (await response.json()) as T;
  }
  if (response.status === 404) {
    throw new HttpError(
      "not_found",
      "Repository or issue not found on GitHub.",
    );
  }
  if (response.status === 403 || response.status === 429) {
    throw new HttpError(
      "rate_limited",
      "GitHub API rate limit reached. Try again shortly.",
    );
  }
  throw new HttpError(
    "upstream_error",
    `GitHub API returned ${response.status}.`,
  );
}
