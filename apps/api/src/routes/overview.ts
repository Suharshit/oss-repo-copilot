import { Hono } from "hono";
import { parseRepoUrl } from "@repo/shared/utils";
import type { OverviewRequest, OverviewResponse } from "@repo/shared/types";
import { HttpError, ok } from "../lib/errors.js";
import { readOverview, upsertRepo, writeOverview } from "../services/db.js";
import { fetchRepo, fetchRepoContext } from "../services/github.js";
import { generationService } from "../services/llm.js";

/** POST /v1/overview — repo summary, tech stack and modules (US-1). */
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
  // expensive part. `refresh` skips the read but still writes the new row.
  if (repoRowId !== null && !body.refresh) {
    const cached = await readOverview(repoRowId, repo.id);
    if (cached) {
      const hit: OverviewResponse = {
        repo,
        overview: cached,
        // TODO (US-4): context.docs holds CONTRIBUTING.md and the PR template —
        // extracting conventions out of them is the other half of llm.ts.
        conventions: null,
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

  const overview = await generationService.generateOverview({
    repo,
    fileTree: context.fileTree,
    readme: context.readme,
    manifests: context.manifests,
  });

  if (repoRowId !== null) {
    await writeOverview(repoRowId, overview);
  }

  const response: OverviewResponse = {
    repo,
    overview,
    conventions: null,
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
