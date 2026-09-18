import { GITHUB_WEB_BASE } from "../constants/index.ts";
import type { RepoRef } from "../types/repo.ts";

export interface IssueRef extends RepoRef {
  number: number;
}

const OWNER_NAME = /^[\w.-]+$/;

/**
 * Parse a pasted repo URL ("https://github.com/vercel/turborepo", with or
 * without protocol, trailing slash, .git suffix or deep path).
 * Returns null rather than throwing — callers turn it into an `invalid_github_url`.
 */
export function parseRepoUrl(input: string): RepoRef | null {
  const segments = githubPathSegments(input);
  if (!segments) return null;

  const [owner, rawName] = segments;
  if (!owner || !rawName) return null;

  const name = rawName.replace(/\.git$/, "");
  if (!OWNER_NAME.test(owner) || !OWNER_NAME.test(name)) return null;

  return { owner, name };
}

/** Parse "https://github.com/owner/repo/issues/123". */
export function parseIssueUrl(input: string): IssueRef | null {
  const segments = githubPathSegments(input);
  if (!segments || segments.length < 4) return null;

  const [, , kind, rawNumber] = segments;
  if (kind !== "issues" && kind !== "pull") return null;

  const number = Number(rawNumber);
  if (!Number.isInteger(number) || number <= 0) return null;

  const repo = parseRepoUrl(input);
  return repo ? { ...repo, number } : null;
}

export function repoUrl({ owner, name }: RepoRef): string {
  return `${GITHUB_WEB_BASE}/${owner}/${name}`;
}

export function issueUrl({ owner, name, number }: IssueRef): string {
  return `${repoUrl({ owner, name })}/issues/${number}`;
}

/** Stable id for a repo, used as the cache key. */
export function repoId({ owner, name }: RepoRef): string {
  return `${owner.toLowerCase()}/${name.toLowerCase()}`;
}

export function issueId(ref: IssueRef): string {
  return `${repoId(ref)}#${ref.number}`;
}

function githubPathSegments(input: string): string[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") return null;

  const segments = url.pathname.split("/").filter(Boolean);
  return segments.length >= 2 ? segments : null;
}
