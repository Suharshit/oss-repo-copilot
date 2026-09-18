import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { MAX_MANIFEST_FILES } from "@repo/shared/constants";
import {
  fetchScoredIssues,
  selectContributing,
  selectDocPaths,
  selectManifestPaths,
} from "./github.js";

/**
 * Path selection decides which files we spend a GitHub request on, and it runs
 * against a tree we do not control. These are pure and need no network, which
 * is why they were written to be exported.
 */
describe("selectManifestPaths", () => {
  it("matches by basename, so a monorepo's package files all count", () => {
    assert.deepEqual(
      selectManifestPaths([
        "package.json",
        "apps/api/package.json",
        "crates/core/Cargo.toml",
        "src/index.ts",
      ]),
      ["package.json", "apps/api/package.json", "crates/core/Cargo.toml"],
    );
  });

  it("puts the shallowest manifest first", () => {
    // The root manifest describes the project; a leaf one describes a corner
    // of it, and the prompt budget may not reach the leaf at all.
    assert.deepEqual(
      selectManifestPaths([
        "a/b/c/package.json",
        "package.json",
        "a/package.json",
      ]),
      ["package.json", "a/package.json", "a/b/c/package.json"],
    );
  });

  it("skips vendored and generated trees", () => {
    assert.deepEqual(
      selectManifestPaths([
        "node_modules/left-pad/package.json",
        "dist/package.json",
        "vendor/x/go.mod",
        "target/debug/Cargo.toml",
        "package.json",
      ]),
      ["package.json"],
    );
  });

  it("does not treat a directory named like a manifest as one", () => {
    assert.deepEqual(selectManifestPaths(["package.json/notes.txt"]), []);
  });

  it("caps the number of manifests it will ask for", () => {
    const tree = Array.from(
      { length: MAX_MANIFEST_FILES + 5 },
      (_, i) => `pkg${i}/package.json`,
    );
    assert.equal(selectManifestPaths(tree).length, MAX_MANIFEST_FILES);
  });

  it("returns nothing for a tree with no manifests", () => {
    assert.deepEqual(selectManifestPaths(["src/main.rs", "README.md"]), []);
  });
});

describe("selectDocPaths", () => {
  it("matches whole paths, not any markdown file", () => {
    assert.deepEqual(
      selectDocPaths([
        "CONTRIBUTING.md",
        "docs/CONTRIBUTING.md",
        "CHANGELOG.md",
        ".github/PULL_REQUEST_TEMPLATE.md",
      ]),
      ["CONTRIBUTING.md", ".github/PULL_REQUEST_TEMPLATE.md"],
    );
  });

  it("matches case-insensitively", () => {
    assert.deepEqual(selectDocPaths(["contributing.md"]), ["contributing.md"]);
  });

  it("leaves the README to fetchReadme", () => {
    // The dedicated endpoint already resolves it whatever it is named, and it
    // is the largest of these files — matching it here would send it twice.
    assert.deepEqual(selectDocPaths(["README.md"]), []);
  });
});

describe("selectContributing", () => {
  it("finds the contributing guide among the fetched docs", () => {
    assert.equal(
      selectContributing({
        "CODE_OF_CONDUCT.md": "be nice",
        "CONTRIBUTING.md": "run the tests",
      }),
      "run the tests",
    );
  });

  it("matches whatever case the repo used", () => {
    assert.equal(selectContributing({ "contributing.md": "rules" }), "rules");
  });

  it("returns null when the repo has none", () => {
    // Null rather than "", because "no contributing guide" is a fact the
    // prompt states rather than a blank section it fills in.
    assert.equal(selectContributing({ "CODE_OF_CONDUCT.md": "be nice" }), null);
    assert.equal(selectContributing({}), null);
  });
});

/**
 * fetchScoredIssues against a stubbed fetch: which queries it sends, and what
 * it keeps from GitHub's issue payload.
 */
describe("fetchScoredIssues", () => {
  const ref = { owner: "acme", name: "widgets" };

  function rawIssue(number: number, extra: Record<string, unknown> = {}) {
    return {
      number,
      title: `Issue ${number}`,
      body: "A long body the list never shows.",
      state: "open",
      comments: 0,
      html_url: `https://github.com/acme/widgets/issues/${number}`,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
      labels: [],
      assignee: null,
      ...extra,
    };
  }

  /** Answers the labelled query with `labelled` and the plain one with `recent`. */
  function stubGitHub(labelled: unknown[], recent: unknown[]) {
    const urls: URL[] = [];
    mock.method(globalThis, "fetch", async (input: string) => {
      const url = new URL(input);
      urls.push(url);
      const body = url.searchParams.has("labels") ? labelled : recent;
      return new Response(JSON.stringify(body), { status: 200 });
    });
    return urls;
  }

  afterEach(() => mock.restoreAll());

  it("queries by the good first issue label and stops when it finds some", async () => {
    const urls = stubGitHub(
      [rawIssue(7, { labels: [{ name: "good first issue" }] })],
      [rawIssue(1)],
    );

    const result = await fetchScoredIssues(ref);

    assert.equal(result.source, "labelled");
    assert.deepEqual(
      result.issues.map((issue) => issue.number),
      [7],
    );
    assert.equal(urls.length, 1);
    assert.equal(urls[0]?.searchParams.get("labels"), "good first issue");
  });

  it("falls back to recent open issues when nothing carries the label", async () => {
    const urls = stubGitHub([], [rawIssue(1), rawIssue(2)]);

    const result = await fetchScoredIssues(ref);

    assert.equal(result.source, "recent");
    assert.equal(result.issues.length, 2);
    assert.equal(urls.length, 2);
    assert.equal(urls[1]?.searchParams.has("labels"), false);
  });

  it("drops pull requests before deciding whether the label matched", async () => {
    // A labelled PR alone must not stop the fallback and leave the list empty.
    stubGitHub(
      [rawIssue(3, { pull_request: {}, labels: ["good first issue"] })],
      [rawIssue(4)],
    );

    const result = await fetchScoredIssues(ref);

    assert.equal(result.source, "recent");
    assert.deepEqual(
      result.issues.map((issue) => issue.number),
      [4],
    );
  });

  it("returns only the fields an issue row shows", async () => {
    stubGitHub([rawIssue(5, { labels: ["good first issue"] })], []);

    const [issue] = (await fetchScoredIssues(ref)).issues;

    assert.deepEqual(Object.keys(issue ?? {}).sort(), [
      "commentCount",
      "createdAt",
      "friendlinessScore",
      "labels",
      "number",
      "title",
      "url",
    ]);
  });

  it("ranks the most approachable issue first", async () => {
    stubGitHub(
      [
        rawIssue(1, { labels: ["good first issue"], comments: 18 }),
        rawIssue(2, { labels: ["good first issue"] }),
      ],
      [],
    );

    const { issues } = await fetchScoredIssues(ref);

    assert.deepEqual(
      issues.map((issue) => issue.number),
      [2, 1],
    );
  });
});
