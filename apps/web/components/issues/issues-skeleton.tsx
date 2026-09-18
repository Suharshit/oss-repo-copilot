import { Section } from "../common/section";
import { Skeleton } from "@/components/ui/skeleton";

const ROWS = 4;

/** Loading state for the issue list: a GitHub read, so seconds rather than a minute. */
export function IssuesSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <Section title="Good first issues">
        <p className="text-sm text-muted-foreground">
          Fetching open issues and ranking them…
        </p>
        <ul className="flex flex-col gap-3" aria-hidden>
          {Array.from({ length: ROWS }, (_, index) => (
            <li
              key={index}
              className="flex flex-col gap-2.5 rounded-[0.625rem] border border-border p-4"
            >
              <Skeleton className="h-5 w-30" />
              <Skeleton className={index % 2 ? "h-4 w-3/5" : "h-4 w-4/5"} />
              <Skeleton className="h-3 w-2/5" />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
