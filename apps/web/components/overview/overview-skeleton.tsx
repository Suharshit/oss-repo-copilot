import { Section } from "../common/section";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the overview. Generation is synchronous (D-02) and a cold
 * repo can take a while, so this says what is happening instead of just spinning.
 */
export function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite">
      <p className="text-sm text-muted-foreground">
        Reading the file tree, README and manifests, then writing the overview.
        The first visit to a repo can take up to a minute.
      </p>

      <Section title="What this repo does">
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-[70%]" />
        </div>
      </Section>

      <Section title="Tech stack">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-26" />
          <Skeleton className="h-7 w-16" />
        </div>
      </Section>

      <Section title="Main modules">
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-3.5 w-[30%]" />
          <Skeleton className="h-3.5 w-[85%]" />
          <Skeleton className="h-3.5 w-1/4" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
      </Section>
    </div>
  );
}
