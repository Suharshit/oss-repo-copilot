import assert from "node:assert/strict";
import { afterEach, before, describe, it, mock } from "node:test";
import type { ContributionBrief, Issue } from "@repo/shared/types";
import { env } from "../env.js";
import { upsertIssue, writeBrief } from "./db.js";

/**
 * Recording a brief (D-20) against a stubbed PostgREST: what is sent, and that
 * a failing database never fails the request that generated the brief.
 */
describe("brief recording", () => {
  const issue: Issue = {
    id: "acme/widgets#7",
    repoId: "acme/widgets",
    number: 7,
    title: "Crash on empty input",
    body: "Steps to reproduce…",
    labels: ["good first issue"],
    state: "open",
    commentCount: 2,
    url: "https://github.com/acme/widgets/issues/7",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    friendlinessScore: 0.85,
  };

  const brief: ContributionBrief = {
    id: "b1",
    issueId: issue.id,
    relevantFiles: [{ path: "src/parse.ts", reason: "Where input is read." }],
    suggestedApproach: "Guard the empty case in parse().",
    generatedAt: "2026-01-03T00:00:00Z",
  };

  interface Sent {
    method: string;
    url: URL;
    body: Record<string, unknown>;
  }

  /** Answers every PostgREST call with `status` and `body`, recording what was sent. */
  function stubPostgrest(status: number, body: unknown) {
    const sent: Sent[] = [];
    mock.method(
      globalThis,
      "fetch",
      async (input: string | URL | Request, init?: RequestInit) => {
        sent.push({
          method: init?.method ?? "GET",
          url: new URL(String(input)),
          body: JSON.parse(String(init?.body ?? "{}")),
        });
        return new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    return sent;
  }

  before(() => {
    // The client is built lazily on first use, so configuring it here is
    // enough; no test in this file touches a real database.
    env.supabaseUrl = "https://example.supabase.co";
    env.supabaseSecretKey = "sb_secret_test";
  });
  afterEach(() => mock.restoreAll());

  it("upserts the issue on its natural key and returns the row id", async () => {
    const sent = stubPostgrest(201, { id: 42 });

    assert.equal(await upsertIssue(9, issue), 42);

    const [request] = sent;
    assert.ok(request);
    assert.equal(request.method, "POST");
    assert.equal(request.url.pathname, "/rest/v1/issues");
    assert.equal(request.url.searchParams.get("on_conflict"), "repo_id,number");
    assert.equal(request.body.repo_id, 9);
    assert.equal(request.body.number, 7);
    assert.equal(request.body.friendliness_score, 0.85);
    assert.equal(request.body.github_created_at, issue.createdAt);
  });

  it("inserts the brief against the issue row, with no conventions notes", async () => {
    const sent = stubPostgrest(201, null);

    await writeBrief(42, brief);

    const [request] = sent;
    assert.ok(request);
    assert.equal(request.method, "POST");
    assert.equal(request.url.pathname, "/rest/v1/contribution_briefs");
    // An insert, not an upsert: the table is a history (D-20).
    assert.equal(request.url.searchParams.get("on_conflict"), null);
    assert.deepEqual(request.body, {
      issue_id: 42,
      relevant_files: brief.relevantFiles,
      suggested_approach: brief.suggestedApproach,
      generated_at: brief.generatedAt,
    });
  });

  it("returns null rather than throwing when the database fails", async () => {
    stubPostgrest(500, { message: "database is down" });
    const logged = mock.method(console, "error", () => {});

    assert.equal(await upsertIssue(9, issue), null);
    await writeBrief(42, brief);

    assert.equal(logged.mock.callCount(), 2);
  });
});
