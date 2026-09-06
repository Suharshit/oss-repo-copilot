import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_MANIFEST_FILES } from "@repo/shared/constants";
import {
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
