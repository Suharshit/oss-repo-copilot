import { Hono } from "hono";
import { parseRepoUrl } from "@repo/shared/utils";
import type {
  OverviewRequest,
  OverviewResponse,
  RepoConventions,
} from "@repo/shared/types";
import { HttpError, ok } from "../lib/errors.js";
import {
  readConventions,
  readOverview,
  upsertRepo,
  writeConventions,
  writeOverview,
} from "../services/db.js";
import { fetchRepo, fetchRepoContext } from "../services/github.js";
import { generationService } from "../services/llm.js";

/** POST /v1/overview — repo summary, tech stack, modules and conventions (US-1, US-4). */
export const overviewRoutes = new Hono().post("/", async (c) => {
  const body = await readBody(c.req.raw);
  const ref = parseRepoUrl(body.url ?? "");
  if (!ref) {
    throw new HttpError(
      "invalid_github_url",
      "Paste a public GitHub repo URL, e.g. https://github.com/owner/repo.",
    );
  }

  const repo = await fetchRepo(ref);
  const repoRowId = await upsertRepo(repo);

  // The cache is read before fetchRepoContext, which is the whole point of it:
  // that call is ~15 GitHub requests and the generation behind it is the
  // expensive part. `refresh` skips the read but still writes the new rows.
  if (repoRowId !== null && !body.refresh) {
    const [cached, cachedConventions] = await Promise.all([
      readOverview(repoRowId, repo.id),
      readConventions(repoRowId, repo.id),
    ]);
    if (cached) {
      const hit: OverviewResponse = {
        repo,
        overview: cached,
        conventions: cachedConventions,
        cached: true,
      };
      return c.json(ok(hit));
    }
  }

  const context = await fetchRepoContext(ref, repo.defaultBranch);

  console.info(
    `fetched ${repo.id}: ${context.fileTree.length} paths${context.treeTruncated ? " (truncated)" : ""}, ` +
      `readme ${context.readme?.length ?? 0} chars, ` +
      `${Object.keys(context.manifests).length} manifests, ` +
      `${Object.keys(context.docs).length} docs`,
  );

  // Two independent generations over one fetch, so they run together rather
  // than adding their latencies. Conventions are skipped entirely when the
  // repo documents nothing — there is no material to extract from, and asking
  // anyway is a paid call that can only invent an answer.
  const hasDocs = Object.keys(context.docs).length > 0;
  const [overview, conventions] = await Promise.all([
    generationService.generateOverview({
      repo,
      fileTree: context.fileTree,
      readme: context.readme,
      manifests: context.manifests,
    }),
    hasDocs
      ? generationService.generateConventions({ repo, docs: context.docs })
      : Promise.resolve<RepoConventions | null>(null),
  ]);

  if (repoRowId !== null) {
    await writeOverview(repoRowId, overview);
    if (conventions) {
      await writeConventions(
        repoRowId,
        conventions,
        overview.generatedAt,
        overview.expiresAt,
      );
    }
  }

  const response: OverviewResponse = {
    repo,
    overview,
    conventions,
    cached: false,
  };
  return c.json(ok(response));
});

async function readBody(request: Request): Promise<Partial<OverviewRequest>> {
  try {
    return (await request.json()) as Partial<OverviewRequest>;
  } catch {
    throw new HttpError(
      "bad_request",
      "Expected a JSON body with a `url` field.",
    );
  }
}
