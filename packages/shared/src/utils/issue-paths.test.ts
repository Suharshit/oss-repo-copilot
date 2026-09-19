import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rankPathsForIssue, words } from "./issue-paths.ts";

/**
 * The brief prompt only shows the model the head of this list, so the order is
 * what decides whether the right file can be cited at all.
 */
describe("rankPathsForIssue", () => {
  const tree = [
    "docs/getting-started.md",
    "src/adapter/bun.ts",
    "src/context.ts",
    "src/request.ts",
    "src/request.test.ts",
    "src/utils/body.ts",
  ];

  it("pulls paths sharing words with the issue ahead of the rest", () => {
    const ranked = rankPathsForIssue(
      tree,
      "A failed c.req.formData() makes all other body methods throw\n\nThe request body cache stores rejected promises.",
    );
    assert.deepEqual(ranked.slice(0, 3), [
      "src/request.ts",
      "src/request.test.ts",
      "src/utils/body.ts",
    ]);
  });

  it("puts a path the issue names outright first", () => {
    const ranked = rankPathsForIssue(
      tree,
      "Crash in src/adapter/bun.ts when the request is aborted",
    );
    assert.equal(ranked[0], "src/adapter/bun.ts");
  });

  it("counts a named filename as a mention too", () => {
    const ranked = rankPathsForIssue(tree, "context.ts leaks a reference");
    assert.equal(ranked[0], "src/context.ts");
  });

  it("weights a filename match over a directory match", () => {
    const ranked = rankPathsForIssue(
      ["adapter/readme.txt", "core/adapter.ts"],
      "adapter breaks",
    );
    assert.deepEqual(ranked, ["core/adapter.ts", "adapter/readme.txt"]);
  });

  it("keeps GitHub's order among paths that score the same", () => {
    const ranked = rankPathsForIssue(
      ["b/router.ts", "a/router.ts", "z.ts"],
      "router",
    );
    assert.deepEqual(ranked, ["b/router.ts", "a/router.ts", "z.ts"]);
  });

  it("ignores a word that matches much of the tree, like the project's name", () => {
    // 30 of 32 paths sit under widget-node/, so "widget" says nothing; the
    // one path matching "launcher" has to win.
    const noise = Array.from(
      { length: 30 },
      (_, i) => `widget-node/part-${i}.ts`,
    );
    const ranked = rankPathsForIssue(
      [...noise, "other/readme.txt", "scripts/launcher.sh"],
      "widget launcher fails on start",
    );
    assert.equal(ranked[0], "scripts/launcher.sh");
  });

  it("returns the tree untouched when nothing matches", () => {
    assert.equal(rankPathsForIssue(tree, "Unrelated words entirely"), tree);
  });

  it("returns the tree untouched for an empty issue", () => {
    assert.equal(rankPathsForIssue(tree, ""), tree);
  });

  it("does not treat a tiny filename inside a word as a mention", () => {
    // "io.go" sits inside "radio.gone" — too short to count as a mention.
    const ranked = rankPathsForIssue(
      ["pkg/io.go", "pkg/radio.go"],
      "radio.gone is missing",
    );
    assert.equal(ranked[0], "pkg/radio.go");
  });
});

describe("words", () => {
  it("splits camelCase and punctuation, lowercased", () => {
    assert.deepEqual(words("formData parseBody"), [
      "form",
      "data",
      "parse",
      "body",
    ]);
  });

  it("drops a plural s so hooks meets hook", () => {
    assert.deepEqual(words("hooks"), ["hook"]);
  });

  it("keeps a double s", () => {
    assert.deepEqual(words("class"), ["class"]);
  });

  it("drops stop words, including plurals of them", () => {
    assert.deepEqual(words("the issues with tests"), []);
  });

  it("drops words shorter than three letters", () => {
    assert.deepEqual(words("a to io api"), ["api"]);
  });
});
