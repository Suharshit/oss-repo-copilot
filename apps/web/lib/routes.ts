import type { RepoRef } from "@repo/shared/types";

/**
 * Web app page paths. Built here, once, so the landing form, links and the
 * README badge (US-5) all agree on the shape of a repo page.
 */
export function repoPagePath({ owner, name }: RepoRef): string {
  return `/r/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}
