import { FIRST_TIMER_LABELS } from "../constants/index.ts";
import type { FriendlinessSignals } from "../types/issue.ts";

const CLAIM_PHRASES = [
  "i'll take this",
  "i will take this",
  "can i work on this",
  "working on this",
  "assigned to me",
  "/assign",
];

/**
 * Deterministic 0-1 approachability score (spec §7 defaults to a heuristic,
 * not an LLM call). Lives in shared so the API can score and the web app can
 * explain the score without a second round trip.
 */
export function friendlinessScore(signals: FriendlinessSignals): number {
  const { labels, commentCount, ageInDays, claimed } = signals;

  const normalized = labels.map((label) => label.toLowerCase().trim());
  const labelHit = FIRST_TIMER_LABELS.findIndex((label) =>
    normalized.includes(label),
  );

  // Earlier labels in FIRST_TIMER_LABELS are stronger signals.
  const labelScore =
    labelHit === -1 ? 0 : 1 - labelHit / FIRST_TIMER_LABELS.length;

  // A long comment thread usually means the issue is contested or subtle.
  const discussionScore =
    commentCount <= 2 ? 1 : Math.max(0, 1 - commentCount / 20);

  // Very fresh issues may not be triaged; very old ones are often stale.
  const ageScore = ageInDays < 3 ? 0.6 : ageInDays > 365 ? 0.3 : 1;

  const raw =
    labelScore * 0.5 +
    discussionScore * 0.3 +
    ageScore * 0.2 -
    (claimed ? 0.4 : 0);

  return clamp(Number(raw.toFixed(3)), 0, 1);
}

/** Cheap check for "someone already called dibs" in the issue thread. */
export function looksClaimed(commentBodies: string[]): boolean {
  return commentBodies.some((body) => {
    const text = body.toLowerCase();
    return CLAIM_PHRASES.some((phrase) => text.includes(phrase));
  });
}

export function daysSince(isoDate: string, now: Date = new Date()): number {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, (now.getTime() - then) / 86_400_000);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
