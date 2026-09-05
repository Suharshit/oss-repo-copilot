import { Hono } from "hono";
import { parseRepoUrl } from "@repo/shared/utils";
import type { IssuesResponse } from "@repo/shared/types";
import { HttpError, ok } from "../lib/errors.js";
import { fetchRepo, fetchScoredIssues } from "../services/github.js";

/** GET /v1/issues?url=... — approachable open issues, ranked (US-2). */
export const issueRoutes = new Hono().get("/", async (c) => {
  const ref = parseRepoUrl(c.req.query("url") ?? "");
  if (!ref) {
    throw new HttpError(
      "invalid_github_url",
      "Pass a public GitHub repo URL as the `url` query parameter.",
    );
  }

  const [repo, issues] = await Promise.all([
    fetchRepo(ref),
    fetchScoredIssues(ref),
  ]);

  const response: IssuesResponse = { repo, issues };
  return c.json(ok(response));
});
