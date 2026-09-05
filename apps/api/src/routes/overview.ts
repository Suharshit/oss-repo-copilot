import { Hono } from "hono";
import { parseRepoUrl } from "@repo/shared/utils";
import type { OverviewRequest, OverviewResponse } from "@repo/shared/types";
import { HttpError, ok } from "../lib/errors.js";
import { fetchRepo } from "../services/github.js";
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

  // TODO: read the cached overview first and only regenerate when it is
  // expired or body.refresh is set (spec §6 caching policy).
  const overview = await generationService.generateOverview({
    repo,
    fileTree: [],
    readme: null,
    manifests: {},
  });

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
