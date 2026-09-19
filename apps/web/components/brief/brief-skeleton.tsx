import { Section } from "../common/section";
import { Skeleton } from "@/components/ui/skeleton";

interface BriefSkeletonProps {
  number: number;
}

/**
 * Loading state for a brief. Every brief is generated fresh (D-06), so this
 * shows on every visit, and it says what is happening instead of just spinning.
 */
export function BriefSkeleton({ number }: BriefSkeletonProps) {
  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite">
      <p className="text-sm text-muted-foreground">
        Reading the issue and the repo&rsquo;s file tree, then writing the
        brief. This usually takes 5 to 20 seconds.
      </p>

      <Section title={`Issue #${number}`}>
        <Skeleton className="h-5 w-[80%]" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
      </Section>

      <Section title="Files to look at">
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-3.5 w-[35%]" />
          <Skeleton className="h-3.5 w-[85%]" />
          <Skeleton className="h-3.5 w-[30%]" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
      </Section>

      <Section title="Suggested approach">
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-[60%]" />
        </div>
      </Section>
    </div>
  );
}
