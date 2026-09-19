import assert from "node:assert/strict";
import { afterEach, before, beforeEach, describe, it, mock } from "node:test";
import type {
  ApiResponse,
  BriefResponse,
  ContributionBrief,
  RepoConventions,
} from "@repo/shared/types";
import { createApp } from "../app.js";
import { env } from "../env.js";
import { resetRateLimits } from "../lib/rate-limit.js";
import { generationService, type BriefInput } from "../services/llm.js";

/**
 * POST /v1/brief end to end through the app, with GitHub stubbed at fetch and
 * the model stubbed at the generation boundary (D-14). The cache is off, which
 * is the path where conventions have to be extracted alongside the brief.
 */
describe("POST /v1/brief", () => {
  const app = createApp();

  const conventions: RepoConventions = {
    repoId: "acme/widgets",
    branchNaming: null,
    testRequirements: "Run pnpm test.",
    lintRules: null,
    prTemplate: null,
    sources: ["CONTRIBUTING.md"],
  };

  function rawIssue(extra: Record<string, unknown> = {}) {
    return {
      number: 7,
      title: "Crash on empty input",
      body: "parse() throws when the input is empty.",
      state: "open",
      comments: 0,
      html_url: "https://github.com/acme/widgets/issues/7",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
      labels: [],
      assignee: null,
      ...extra,
    };
  }

  /** A tiny fake GitHub: the repo, issue #7, a tree, and raw file contents. */
  function stubGitHub(tree: string[], issue = rawIssue()) {
    const requested: string[] = [];
    mock.method(globalThis, "fetch", async (input: string) => {
      const { pathname } = new URL(input);
      requested.push(pathname);
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), { status: 200 });

      if (pathname === "/repos/acme/widgets") {
        return json({ default_branch: "main", language: "TypeScript" });
      }
      if (pathname === "/repos/acme/widgets/issues/7") return json(issue);
      if (pathname.includes("/git/trees/")) {
        return json({
          tree: tree.map((path) => ({ path, type: "blob" })),
          truncated: false,
        });
      }
      if (pathname.includes("/contents/")) {
        return new Response("Please run pnpm test.", { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });
    return requested;
  }

  /** Stubs both generations and records what the brief was given. */
  function stubModel() {
    const briefInputs: BriefInput[] = [];
    mock.method(
      generationService,
      "generateBrief",
      async (input: BriefInput): Promise<ContributionBrief> => {
        briefInputs.push(input);
        return {
          id: "b1",
          issueId: input.issue.id,
          relevantFiles: [{ path: "src/parse.ts", reason: "Where it throws." }],
          suggestedApproach: "Guard the empty case.",
          generatedAt: "2026-01-03T00:00:00Z",
        };
      },
    );
    const extract = mock.method(
      generationService,
      "generateConventions",
      async () => conventions,
    );
    return { briefInputs, extract };
  }

  function post(url: string) {
    return app.request("/v1/brief", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "203.0.113.7",
      },
      body: JSON.stringify({ url }),
    });
  }

  before(() => {
    // No database: every cache read misses and every write is skipped.
    env.supabaseUrl = undefined;
    env.supabaseSecretKey = undefined;
    // Lets the limiter key on X-Forwarded-For; app.request has no socket.
    env.trustProxy = true;
  });
  beforeEach(() => {
    resetRateLimits();
    mock.method(console, "warn", () => {});
  });
  afterEach(() => mock.restoreAll());

  it("returns the brief with conventions extracted on a cache miss", async () => {
    const requested = stubGitHub([
      "CONTRIBUTING.md",
      "README.md",
      "package.json",
      "src/parse.ts",
    ]);
    const { briefInputs, extract } = stubModel();

    const response = await post("https://github.com/acme/widgets/issues/7");
    const body = (await response.json()) as ApiResponse<BriefResponse>;

    assert.equal(response.status, 200);
    assert.ok(body.ok);
    assert.equal(body.data.issue.number, 7);
    assert.deepEqual(body.data.conventions, conventions);
    assert.equal(extract.mock.callCount(), 1);

    // Nothing was cached, so the brief read the raw CONTRIBUTING.md instead.
    const [input] = briefInputs;
    assert.ok(input);
    assert.equal(input.conventions, null);
    assert.equal(input.contributing, "Please run pnpm test.");

    // A brief reads no README and no manifests (fetchBriefContext).
    assert.ok(!requested.some((path) => path.endsWith("/readme")));
    assert.ok(!requested.some((path) => path.endsWith("/package.json")));
  });

  it("doesn't ask for conventions when the repo documents none", async () => {
    stubGitHub(["src/parse.ts"]);
    const { extract } = stubModel();

    const response = await post("https://github.com/acme/widgets/issues/7");
    const body = (await response.json()) as ApiResponse<BriefResponse>;

    assert.ok(body.ok);
    assert.equal(body.data.conventions, null);
    assert.equal(extract.mock.callCount(), 0);
  });

  it("says so plainly when the number is a pull request", async () => {
    stubGitHub([], rawIssue({ pull_request: {} }));
    const { briefInputs } = stubModel();

    const response = await post("https://github.com/acme/widgets/pull/7");
    const body = (await response.json()) as ApiResponse<BriefResponse>;

    assert.equal(response.status, 404);
    assert.ok(!body.ok);
    assert.equal(body.error.message, "#7 is a pull request, not an issue.");
    assert.equal(briefInputs.length, 0, "no generation for a PR");
  });

  it("rejects a URL that isn't an issue before calling anyone", async () => {
    const requested = stubGitHub([]);
    stubModel();

    const response = await post("https://github.com/acme/widgets");
    const body = (await response.json()) as ApiResponse<BriefResponse>;

    assert.equal(response.status, 400);
    assert.ok(!body.ok);
    assert.equal(body.error.code, "invalid_github_url");
    assert.equal(requested.length, 0);
  });
});
