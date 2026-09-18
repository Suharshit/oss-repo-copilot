"use client";

import Link from "next/link";
import type { RepoRef } from "@repo/shared/types";
import { Button } from "@repo/shared/ui/button";
import { useRankedIssues } from "../../hooks/use-ranked-issues";
import { ERROR_TITLES } from "../../lib/load-error";
import { ErrorState } from "../common/error-state";
import { IssueList } from "./issue-list";
import { IssuesSkeleton } from "./issues-skeleton";

interface IssuesPanelProps {
  repoRef: RepoRef;
}

/** No model is involved in the issue list, only GitHub. */
const ISSUE_ERROR_TITLES: Record<string, string> = {
  ...ERROR_TITLES,
  upstream_error: "GitHub didn't respond",
};

/** US-2: the issues tab of a repo page. Owns the loading, error and retry states. */
export function IssuesPanel({ repoRef }: IssuesPanelProps) {
  const { data, error, pending, reload } = useRankedIssues(repoRef);

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <ErrorState
          title={ISSUE_ERROR_TITLES[error.code] ?? "Something went wrong"}
          message={error.message}
          actions={
            <>
              {/* Retrying a missing repo can't succeed, so it only offers a way out. */}
              {error.code !== "not_found" && (
                <Button onClick={() => void reload()} disabled={pending}>
                  Try again
                </Button>
              )}
              <Link
                href="/"
                className="text-sm text-muted hover:text-foreground hover:underline"
              >
                Try another repo
              </Link>
            </>
          }
        />
      )}

      {pending && !data && <IssuesSkeleton />}

      {data && (
        <div
          className="transition-opacity duration-200 data-stale:opacity-55"
          aria-busy={pending}
          data-stale={pending || undefined}
        >
          <IssueList repo={repoRef} response={data} />
        </div>
      )}
    </div>
  );
}
