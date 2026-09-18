import type { ReactNode } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
    <Card
      className={cn(
        "gap-4 border border-border ring-0 [--card-spacing:--spacing(5)]",
        className,
      )}
    >
      <CardHeader className="items-center">
        <CardTitle
          role="heading"
          aria-level={2}
          className="text-[0.8125rem] font-semibold tracking-[0.04em] text-muted-foreground uppercase"
        >
          {title}
        </CardTitle>
        {actions && <CardAction className="self-center">{actions}</CardAction>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-base">
        {children}
      </CardContent>
    </Card>
  );
}
