import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title: string;
  /** User-facing text; API error messages are already written for newcomers. */
  message: string;
  /** Buttons or links, e.g. retry and "try another repo". */
  actions?: ReactNode;
  className?: string;
}

export function ErrorState({
  title,
  message,
  actions,
  className,
}: ErrorStateProps) {
  return (
    <Alert
      variant="destructive"
      className={cn(
        "gap-2 rounded-xl border-destructive/30 bg-destructive/5 p-5",
        className,
      )}
    >
      <AlertTitle className="text-base font-semibold">{title}</AlertTitle>
      <AlertDescription className="text-base/normal text-muted-foreground">
        {message}
      </AlertDescription>
      {actions && (
        <div className="mt-2 flex flex-wrap items-center gap-3">{actions}</div>
      )}
    </Alert>
  );
}
