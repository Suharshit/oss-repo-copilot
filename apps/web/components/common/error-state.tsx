import type { ReactNode } from "react";

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
    <div
      role="alert"
      className={[
        "flex flex-col gap-2 rounded-xl border border-danger-border bg-danger-surface p-5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="leading-normal text-muted">{message}</p>
      {actions && (
        <div className="mt-2 flex flex-wrap items-center gap-3">{actions}</div>
      )}
    </div>
  );
}
