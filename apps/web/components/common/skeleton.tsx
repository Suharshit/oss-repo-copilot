interface SkeletonProps {
  /** CSS width, e.g. "60%" or "8rem". */
  width?: string;
  height?: string;
  className?: string;
}

/** A shimmering placeholder bar. Decorative: callers announce loading themselves. */
export function Skeleton({
  width = "100%",
  height = "0.875rem",
  className,
}: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={[
        "block animate-shimmer rounded-md bg-linear-to-r from-border from-25% via-surface via-50% to-border to-75% bg-size-[200%_100%] motion-reduce:animate-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ width, height }}
    />
  );
}
