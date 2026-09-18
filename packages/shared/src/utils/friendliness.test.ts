import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clamp,
  daysSince,
  friendlinessScore,
  friendlinessTier,
  looksClaimed,
} from "./friendliness.ts";

/**
 * The score is a deterministic heuristic, not a model, so it can be pinned
 * exactly. These numbers are the contract: changing a weight should fail here
 * loudly rather than quietly reshuffle the issue list a newcomer is shown.
 */
describe("friendlinessScore", () => {
  const base = { labels: [], commentCount: 0, ageInDays: 30, claimed: false };

  it("gives the top score to a fresh, unclaimed, well-labelled issue", () => {
    assert.equal(
      friendlinessScore({ ...base, labels: ["good first issue"] }),
      1,
    );
  });

  it("clusters unlabelled issues at 0.5", () => {
    // The ceiling without a label hit. Worth pinning: on a repo that labels
    // nothing, every issue lands here and the ranking carries no information.
    assert.equal(friendlinessScore(base), 0.5);
  });

  it("ranks earlier entries in FIRST_TIMER_LABELS above later ones", () => {
    const first = friendlinessScore({ ...base, labels: ["good first issue"] });
    const last = friendlinessScore({ ...base, labels: ["easy"] });
    assert.ok(first > last, `${first} should beat ${last}`);
  });

  it("matches labels case-insensitively and ignores surrounding space", () => {
    assert.equal(
      friendlinessScore({ ...base, labels: ["  Good First Issue  "] }),
      friendlinessScore({ ...base, labels: ["good first issue"] }),
    );
  });

  it("penalises a claimed issue by 0.4", () => {
    const open = friendlinessScore({ ...base, labels: ["good first issue"] });
    const taken = friendlinessScore({
      ...base,
      labels: ["good first issue"],
      claimed: true,
    });
    assert.equal(Number((open - taken).toFixed(3)), 0.4);
  });

  it("treats a long comment thread as contested", () => {
    const quiet = friendlinessScore({ ...base, commentCount: 2 });
    const busy = friendlinessScore({ ...base, commentCount: 15 });
    assert.ok(quiet > busy, `${quiet} should beat ${busy}`);
  });

  it("discounts issues that are very new or very old", () => {
    const settled = friendlinessScore({ ...base, ageInDays: 30 });
    assert.ok(friendlinessScore({ ...base, ageInDays: 1 }) < settled);
    assert.ok(friendlinessScore({ ...base, ageInDays: 400 }) < settled);
  });

  it("never leaves the 0-1 range", () => {
    const worst = friendlinessScore({
      labels: [],
      commentCount: 40,
      ageInDays: 400,
      claimed: true,
    });
    assert.equal(worst, 0);
    assert.ok(worst >= 0 && worst <= 1);
  });
});

describe("looksClaimed", () => {
  it("spots a claim regardless of case", () => {
    assert.equal(looksClaimed(["I'll take this one!"]), true);
    assert.equal(looksClaimed(["nice", "Working on this now"]), true);
  });

  it("does not fire on ordinary discussion", () => {
    assert.equal(looksClaimed(["This also happens on Windows."]), false);
    assert.equal(looksClaimed([]), false);
  });
});

describe("friendlinessTier", () => {
  const base = { labels: [], commentCount: 0, ageInDays: 30, claimed: false };

  it("calls a quiet, labelled issue great", () => {
    const score = friendlinessScore({ ...base, labels: ["good first issue"] });
    assert.equal(friendlinessTier(score), "great");
  });

  it("never calls an unlabelled issue great", () => {
    // Unlabelled issues top out at 0.5, below the "good" cut-off too.
    assert.equal(friendlinessTier(friendlinessScore(base)), "tricky");
  });

  it("puts each threshold in the higher tier", () => {
    assert.equal(friendlinessTier(0.8), "great");
    assert.equal(friendlinessTier(0.799), "good");
    assert.equal(friendlinessTier(0.6), "good");
    assert.equal(friendlinessTier(0.599), "tricky");
  });
});

describe("daysSince", () => {
  it("measures backwards from now", () => {
    const now = new Date("2026-01-11T00:00:00Z");
    assert.equal(daysSince("2026-01-01T00:00:00Z", now), 10);
  });

  it("returns 0 for a future date rather than a negative age", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    assert.equal(daysSince("2026-06-01T00:00:00Z", now), 0);
  });

  it("returns 0 for an unparseable date", () => {
    assert.equal(daysSince("not a date"), 0);
  });
});

describe("clamp", () => {
  it("bounds on both sides and passes the middle through", () => {
    assert.equal(clamp(-1, 0, 1), 0);
    assert.equal(clamp(2, 0, 1), 1);
    assert.equal(clamp(0.5, 0, 1), 0.5);
  });
});
