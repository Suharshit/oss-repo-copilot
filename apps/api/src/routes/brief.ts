import { Hono } from "hono";
import { parseIssueUrl } from "@repo/shared/utils";
import type { BriefRequest, BriefResponse } from "@repo/shared/types";
import { HttpError, ok } from "../lib/errors.js";
import { fetchRepo, fetchScoredIssues } from "../services/github.js";
import { generationService } from "../services/llm.js";

/** POST /v1/brief — relevant files + approach for one issue (US-3). */
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

  // TODO: fetch the single issue directly instead of scanning the open list.
  const issues = await fetchScoredIssues(ref);
  const issue = issues.find((candidate) => candidate.number === ref.number);
  if (!issue) {
    throw new HttpError("not_found", `Issue #${ref.number} was not found.`);
  }

  const brief = await generationService.generateBrief({
    repo,
    issue,
    fileTree: [],
    contributing: null,
  });

  const response: BriefResponse = { repo, issue, brief };
  return c.json(ok(response));
});

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
