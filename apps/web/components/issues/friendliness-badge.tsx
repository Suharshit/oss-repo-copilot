import type { FriendlinessTier } from "@repo/shared/types";
import { friendlinessTier } from "@repo/shared/utils";
import styles from "./friendliness-badge.module.css";

interface FriendlinessBadgeProps {
  /** The API's 0-1 friendliness score. */
  score: number;
  className?: string;
}

const TIER_LABELS: Record<FriendlinessTier, string> = {
  great: "Great first issue",
  good: "Good first issue",
  tricky: "May need context",
};

/** The verdict for one issue, with its score out of 100 alongside. */
export function FriendlinessBadge({
  score,
  className,
}: FriendlinessBadgeProps) {
  const tier = friendlinessTier(score);
  const outOf100 = Math.round(score * 100);

  return (
    <span className={[styles.wrap, className].filter(Boolean).join(" ")}>
      <span className={`${styles.badge} ${styles[tier]}`}>
        {TIER_LABELS[tier]}
      </span>
      <span
        className={styles.score}
        aria-label={`Approachability score ${outOf100} out of 100`}
      >
        {outOf100}/100
      </span>
    </span>
  );
}
