import type { RepoRef } from "@repo/shared/types";
import { parseRepoUrl } from "@repo/shared/utils";

/** The tabs of a repo page. The first is the default and is left out of the URL. */
export const REPO_TABS = ["overview", "issues"] as const;
export type RepoTab = (typeof REPO_TABS)[number];

/**
 * Web app page paths. Built here, once, so the landing form, links and the
 * README badge (US-5) all agree on the shape of a repo page.
 */
export function repoPagePath(
  { owner, name }: RepoRef,
  tab: RepoTab = "overview",
): string {
  const path = `/r/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  return tab === "overview" ? path : `${path}?tab=${tab}`;
}

/** An issue's page on a repo, where its contribution brief will live (US-3). */
export function issuePagePath(ref: RepoRef, number: number): string {
  return `${repoPagePath(ref)}/issues/${number}`;
}

/** `?tab=` comes straight from the address bar; anything unknown means the default. */
export function parseRepoTab(value: string | string[] | undefined): RepoTab {
  return REPO_TABS.find((tab) => tab === value) ?? "overview";
}

/** Route params come straight from the address bar, so validate them the way a pasted URL is. */
export function parseRepoParams({
  owner,
  name,
}: {
  owner: string;
  name: string;
}): RepoRef | null {
  return parseRepoUrl(`github.com/${owner}/${name}`);
}

/** An issue number from the address bar: a positive integer, or null. */
export function parseIssueNumber(value: string): number | null {
  const number = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(number) && number > 0
    ? number
    : null;
}
