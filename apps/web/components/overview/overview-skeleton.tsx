import { Section } from "../common/section";
import { Skeleton } from "../common/skeleton";

/**
 * Loading state for the overview. Generation is synchronous (D-02) and a cold
 * repo can take a while, so this says what is happening instead of just spinning.
 */
export function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite">
      <p className="text-sm text-muted">
        Reading the file tree, README and manifests, then writing the overview.
        The first visit to a repo can take up to a minute.
      </p>

      <Section title="What this repo does">
        <div className="flex flex-col gap-2.5">
          <Skeleton />
          <Skeleton />
          <Skeleton width="70%" />
        </div>
      </Section>

      <Section title="Tech stack">
        <div className="flex flex-wrap gap-2">
          <Skeleton width="5rem" height="1.75rem" />
          <Skeleton width="6.5rem" height="1.75rem" />
          <Skeleton width="4rem" height="1.75rem" />
        </div>
      </Section>

      <Section title="Main modules">
        <div className="flex flex-col gap-2.5">
          <Skeleton width="30%" />
          <Skeleton width="85%" />
          <Skeleton width="25%" />
          <Skeleton width="75%" />
        </div>
      </Section>
    </div>
  );
}
