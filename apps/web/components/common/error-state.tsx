import type { ReactNode } from "react";
import styles from "./error-state.module.css";

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
      className={[styles.error, className].filter(Boolean).join(" ")}
    >
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
