import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OVERVIEW_TTL_DAYS } from "../constants/index.ts";
import {
  formatRelativeTime,
  isExpired,
  overviewExpiry,
  truncate,
} from "./format.ts";

describe("truncate", () => {
  it("leaves text within the budget alone", () => {
    assert.equal(truncate("hello", 5), "hello");
    assert.equal(truncate("", 10), "");
  });

  it("never exceeds the budget it was given", () => {
    // The prompt budget is the whole point of this function: an off-by-one
    // here is paid for on every generation.
    const result = truncate("hello world", 5);
    assert.equal(result.length, 5);
    assert.ok(result.endsWith("…"));
  });

  it("does not leave a dangling space before the ellipsis", () => {
    assert.equal(truncate("ab cdef", 4), "ab…");
  });
});

describe("overviewExpiry / isExpired", () => {
  const generatedAt = new Date("2026-01-01T00:00:00.000Z");

  it("expires an overview OVERVIEW_TTL_DAYS after generation", () => {
    const expiry = overviewExpiry(generatedAt);
    const days =
      (new Date(expiry).getTime() - generatedAt.getTime()) / 86_400_000;
    assert.equal(days, OVERVIEW_TTL_DAYS);
  });

  it("treats a fresh overview as live and an old one as expired", () => {
    const expiry = overviewExpiry(generatedAt);
    assert.equal(isExpired(expiry, generatedAt), false);
    assert.equal(isExpired(expiry, new Date("2026-02-01T00:00:00.000Z")), true);
  });

  it("counts the exact expiry moment as expired", () => {
    const expiry = overviewExpiry(generatedAt);
    assert.equal(isExpired(expiry, new Date(expiry)), true);
  });

  it("treats an unparseable expiry as expired", () => {
    // Fail towards regenerating: a bad row costs one generation, whereas
    // trusting it would serve a stale overview forever.
    assert.equal(isExpired("nonsense"), true);
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-01-10T12:00:00.000Z");

  it("picks the largest unit that fits", () => {
    assert.equal(
      formatRelativeTime("2026-01-09T12:00:00.000Z", now),
      "yesterday",
    );
    assert.equal(
      formatRelativeTime("2026-01-10T11:00:00.000Z", now),
      "1 hour ago",
    );
    assert.equal(
      formatRelativeTime("2025-01-10T12:00:00.000Z", now),
      "last year",
    );
  });

  it("says so rather than throwing on an unparseable date", () => {
    assert.equal(formatRelativeTime("not a date", now), "unknown");
  });
});
