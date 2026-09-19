import { Hono } from "hono";
import { overviewExpiry, parseIssueUrl } from "@repo/shared/utils";
import type {
  BriefRequest,
  BriefResponse,
  Repo,
  RepoConventions,
} from "@repo/shared/types";
import { HttpError, ok } from "../lib/errors.js";
import {
  readConventions,
  upsertRepo,
  writeConventions,
} from "../services/db.js";
import {
  fetchIssue,
  fetchRepo,
  fetchRepoContext,
  selectContributing,
} from "../services/github.js";
import { generationService } from "../services/llm.js";

/** POST /v1/brief — relevant files + approach for one issue, plus the repo's conventions (US-3, US-4). */
export const briefRoutes = new Hono().post("/", async (c) => {
  const body = await readBody(c.req.raw);
  const ref = parseIssueUrl(body.url ?? "");
  if (!ref) {
    throw new HttpError(
      "invalid_github_url",
      "Paste a GitHub issue URL, e.g. https://github.com/owner/repo/issues/123.",
    );
  }

  const repo = await fetchRepo(ref);

  // The issue is fetched by number rather than scanned out of the open list:
  // that list is capped, excludes closed issues, and drops PRs silently.
  // fetchIssue finds closed issues and says plainly when the URL is a PR.
  const [cache, issue, context] = await Promise.all([
    readCachedConventions(repo),
    fetchIssue(ref, ref.number),
    fetchRepoContext(ref, repo.defaultBranch),
  ]);

  // Conventions come from the overview's cache row, so the brief page and the
  // overview tab show the same rules (D-22). On a miss they're extracted here,
  // alongside the brief rather than before it, so the miss costs no latency;
  // the brief then reads raw CONTRIBUTING.md instead. A repo with no docs has
  // nothing to extract, so it isn't asked.
  const needsConventions =
    cache.conventions === null && Object.keys(context.docs).length > 0;
  const [brief, fresh] = await Promise.all([
    generationService.generateBrief({
      repo,
      issue,
      fileTree: context.fileTree,
      conventions: cache.conventions,
      contributing: selectContributing(context.docs),
    }),
    needsConventions
      ? generationService.generateConventions({ repo, docs: context.docs })
      : Promise.resolve(null),
  ]);

  if (fresh && cache.repoRowId !== null) {
    const generatedAt = new Date();
    await writeConventions(
      cache.repoRowId,
      fresh,
      generatedAt.toISOString(),
      overviewExpiry(generatedAt),
    );
  }

  const response: BriefResponse = {
    repo,
    issue,
    brief,
    conventions: cache.conventions ?? fresh,
  };
  return c.json(ok(response));
});

/** The repo's cache row id and its unexpired conventions; both null when the cache is off. */
async function readCachedConventions(repo: Repo): Promise<{
  repoRowId: number | null;
  conventions: RepoConventions | null;
}> {
  const repoRowId = await upsertRepo(repo);
  if (repoRowId === null) return { repoRowId, conventions: null };
  return { repoRowId, conventions: await readConventions(repoRowId, repo.id) };
}

async function readBody(request: Request): Promise<Partial<BriefRequest>> {
  try {
    return (await request.json()) as Partial<BriefRequest>;
  } catch {
    throw new HttpError(
      "bad_request",
      "Expected a JSON body with a `url` field.",
    );
  }
}
