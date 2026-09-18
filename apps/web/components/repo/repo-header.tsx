import type { ReactNode } from "react";
import type { RepoRef } from "@repo/shared/types";
import { repoUrl } from "@repo/shared/utils";

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
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="text-[clamp(1.5rem,4vw,2rem)] leading-[1.2] font-bold tracking-[-0.02em] wrap-anywhere">
          <span className="font-normal text-muted-foreground">
            {repo.owner}/
          </span>
          {repo.name}
        </h1>
        <a
          className="w-fit text-sm text-muted-foreground hover:text-foreground hover:underline"
          href={repoUrl(repo)}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub ↗
        </a>
        {meta && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-muted-foreground">
            {meta}
          </div>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  );
}
