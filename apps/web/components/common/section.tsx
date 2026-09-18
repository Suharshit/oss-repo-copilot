import type { ReactNode } from "react";
import styles from "./section.module.css";

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
    <section className={[styles.section, className].filter(Boolean).join(" ")}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}
