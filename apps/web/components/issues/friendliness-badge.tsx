import type { FriendlinessTier } from "@repo/shared/types";
import { friendlinessTier } from "@repo/shared/utils";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

const TIER_CLASSES: Record<FriendlinessTier, string> = {
  great: "border-great-border bg-great-surface text-great",
  good: "border-good-border bg-good-surface text-good",
  tricky: "text-muted-foreground",
};

/** The verdict for one issue, with its score out of 100 alongside. */
export function FriendlinessBadge({
  score,
  className,
}: FriendlinessBadgeProps) {
  const tier = friendlinessTier(score);
  const outOf100 = Math.round(score * 100);

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Badge
        variant="outline"
        className={cn("font-semibold", TIER_CLASSES[tier])}
      >
        {TIER_LABELS[tier]}
      </Badge>
      <span
        className="text-xs text-muted-foreground tabular-nums"
        aria-label={`Approachability score ${outOf100} out of 100`}
      >
        {outOf100}/100
      </span>
    </span>
  );
}
