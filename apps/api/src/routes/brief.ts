import { Hono } from "hono";
import { parseIssueUrl } from "@repo/shared/utils";
import type { BriefRequest, BriefResponse } from "@repo/shared/types";
import { HttpError, ok } from "../lib/errors.js";
import {
  fetchIssue,
  fetchRepo,
  fetchRepoContext,
  selectContributing,
} from "../services/github.js";
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

  // The issue is fetched by number rather than scanned out of the open list:
  // that list is capped, excludes closed issues, and drops PRs silently.
  // fetchIssue finds closed issues and says plainly when the URL is a PR.
  const [issue, context] = await Promise.all([
    fetchIssue(ref, ref.number),
    fetchRepoContext(ref, repo.defaultBranch),
  ]);

  const brief = await generationService.generateBrief({
    repo,
    issue,
    fileTree: context.fileTree,
    contributing: selectContributing(context.docs),
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
