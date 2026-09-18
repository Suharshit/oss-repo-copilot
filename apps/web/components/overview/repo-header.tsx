import type { ReactNode } from "react";
import type { RepoRef } from "@repo/shared/types";
import { repoUrl } from "@repo/shared/utils";
import styles from "./repo-header.module.css";

interface RepoHeaderProps {
  repo: RepoRef;
  /** Small facts under the title (language, branch, freshness). Omitted while loading. */
  meta?: ReactNode;
  /** Right-aligned controls, e.g. the Regenerate button. */
  actions?: ReactNode;
}

/**
 * Title block of a repo page. Takes a bare RepoRef so it can render from the
 * URL alone, before the API has answered.
 */
export function RepoHeader({ repo, meta, actions }: RepoHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.heading}>
        <h1 className={styles.title}>
          <span className={styles.owner}>{repo.owner}/</span>
          {repo.name}
        </h1>
        <a
          className={styles.link}
          href={repoUrl(repo)}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub ↗
        </a>
        {meta && <div className={styles.meta}>{meta}</div>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
