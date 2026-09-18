import type { ReactNode } from "react";

interface SectionProps {
  title: string;
  /** Optional right-aligned slot in the header, e.g. a count or a button. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** A titled card. Every block on a repo page (overview, issues, brief) is one. */
export function Section({ title, actions, className, children }: SectionProps) {
  return (
    <section
      className={[
        "flex flex-col gap-4 rounded-xl border border-border bg-surface p-5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-[0.8125rem] font-semibold tracking-[0.04em] text-muted uppercase">
          {title}
        </h2>
        {actions}
      </header>
      {children}
    </section>
  );
}
