import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  issueId,
  issueUrl,
  parseGithubUrl,
  parseIssueUrl,
  parseRepoUrl,
  repoId,
  repoUrl,
} from "./github-url.ts";

/**
 * These parse whatever a user pasted, so the interesting cases are the untidy
 * ones — a missing protocol, a trailing slash, a deep link into a file.
 */
describe("parseRepoUrl", () => {
  const expected = { owner: "vercel", name: "turborepo" };

  it("accepts the forms a user actually pastes", () => {
    for (const input of [
      "https://github.com/vercel/turborepo",
      "http://github.com/vercel/turborepo",
      "github.com/vercel/turborepo",
      "www.github.com/vercel/turborepo",
      "https://github.com/vercel/turborepo/",
      "https://github.com/vercel/turborepo.git",
      "https://github.com/vercel/turborepo/blob/main/README.md",
      "  https://github.com/vercel/turborepo  ",
    ]) {
      assert.deepEqual(parseRepoUrl(input), expected, `failed on: ${input}`);
    }
  });

  it("rejects anything that is not a GitHub repo URL", () => {
    for (const input of [
      "",
      "   ",
      "not a url",
      "https://gitlab.com/vercel/turborepo",
      "https://github.com.evil.test/vercel/turborepo",
      "https://github.com/vercel",
    ]) {
      assert.equal(parseRepoUrl(input), null, `should reject: ${input}`);
    }
  });
});

describe("parseIssueUrl", () => {
  it("parses an issue URL", () => {
    assert.deepEqual(
      parseIssueUrl("https://github.com/honojs/hono/issues/5313"),
      {
        owner: "honojs",
        name: "hono",
        number: 5313,
      },
    );
  });

  it("accepts a pull request URL", () => {
    // Deliberate: /v1/brief resolves the number through fetchIssue, which
    // reports a PR as such rather than the URL silently parsing to null.
    assert.deepEqual(parseIssueUrl("https://github.com/honojs/hono/pull/42"), {
      owner: "honojs",
      name: "hono",
      number: 42,
    });
  });

  it("rejects a repo URL, a non-issue path, and a bad number", () => {
    for (const input of [
      "https://github.com/honojs/hono",
      "https://github.com/honojs/hono/discussions/12",
      "https://github.com/honojs/hono/issues/abc",
      "https://github.com/honojs/hono/issues/0",
      "https://github.com/honojs/hono/issues/-1",
    ]) {
      assert.equal(parseIssueUrl(input), null, `should reject: ${input}`);
    }
  });
});

describe("parseGithubUrl", () => {
  const repo = { owner: "honojs", name: "hono" };

  it("reads an issue URL as the issue, not its repo", () => {
    assert.deepEqual(
      parseGithubUrl("https://github.com/honojs/hono/issues/5313"),
      { kind: "issue", ref: { ...repo, number: 5313 } },
    );
  });

  it("tells a pull request apart from an issue", () => {
    assert.deepEqual(parseGithubUrl("github.com/honojs/hono/pull/42/files"), {
      kind: "pull",
      ref: { ...repo, number: 42 },
    });
  });

  it("reads anything else under a repo as the repo", () => {
    for (const input of [
      "https://github.com/honojs/hono",
      "https://github.com/honojs/hono/issues",
      "https://github.com/honojs/hono/blob/main/README.md",
      "https://github.com/honojs/hono/discussions/12",
    ]) {
      assert.deepEqual(
        parseGithubUrl(input),
        { kind: "repo", ref: repo },
        `failed on: ${input}`,
      );
    }
  });

  it("rejects what is not a GitHub URL", () => {
    assert.equal(
      parseGithubUrl("https://gitlab.com/honojs/hono/issues/1"),
      null,
    );
    assert.equal(parseGithubUrl(""), null);
  });
});

describe("ids", () => {
  it("lowercases, so the cache key does not depend on how it was typed", () => {
    assert.equal(repoId({ owner: "HonoJS", name: "Hono" }), "honojs/hono");
    assert.equal(
      issueId({ owner: "HonoJS", name: "Hono", number: 7 }),
      "honojs/hono#7",
    );
  });
});

describe("urls", () => {
  it("round-trips a parsed ref back to a canonical URL", () => {
    const ref = parseRepoUrl("github.com/vercel/turborepo.git");
    assert.ok(ref);
    assert.equal(repoUrl(ref), "https://github.com/vercel/turborepo");
    assert.equal(
      issueUrl({ ...ref, number: 9 }),
      "https://github.com/vercel/turborepo/issues/9",
    );
  });
});
