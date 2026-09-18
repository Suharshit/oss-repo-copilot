import { Section } from "../common/section";
import { Skeleton } from "../common/skeleton";
import styles from "./issues-skeleton.module.css";

const ROWS = 4;

/** Loading state for the issue list: a GitHub read, so seconds rather than a minute. */
export function IssuesSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <Section title="Good first issues">
        <p className={styles.notice}>Fetching open issues and ranking them…</p>
        <ul className={styles.list} aria-hidden>
          {Array.from({ length: ROWS }, (_, index) => (
            <li key={index} className={styles.row}>
              <Skeleton width="7.5rem" height="1.25rem" />
              <Skeleton width={index % 2 ? "60%" : "80%"} height="1rem" />
              <Skeleton width="40%" height="0.75rem" />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
