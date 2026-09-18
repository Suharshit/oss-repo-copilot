import styles from "./skeleton.module.css";

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
      className={[styles.skeleton, className].filter(Boolean).join(" ")}
      style={{ width, height }}
    />
  );
}
