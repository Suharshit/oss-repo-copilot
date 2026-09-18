"use client";

import Link from "next/link";
import { Button } from "@repo/shared/ui/button";
import type { RepoOverviewState } from "../../hooks/use-repo-overview";
import { ERROR_TITLES } from "../../lib/load-error";
import { ErrorState } from "../common/error-state";
import { ConventionsSection } from "./conventions-section";
import { ModulesSection } from "./modules-section";
import { OverviewSkeleton } from "./overview-skeleton";
import { SummarySection } from "./summary-section";
import { TechStackSection } from "./tech-stack-section";

interface RepoOverviewProps {
  /** Owned by RepoView, which also shows the overview's meta and Regenerate in the header. */
  state: RepoOverviewState;
}

/** US-1: the overview tab of a repo page. Renders the loading, error and loaded states. */
export function RepoOverview({ state }: RepoOverviewProps) {
  const { data, error, pending, reload } = state;

  return (
    <div className="flex flex-col gap-4">
      {/* A failed regenerate keeps the old overview on screen below the error. */}
      {error && (
        <ErrorState
          title={ERROR_TITLES[error.code] ?? "Something went wrong"}
          message={error.message}
          actions={
            <>
              {/* Retrying a missing repo can't succeed, so it only offers a way out. */}
              {error.code !== "not_found" && (
                <Button onClick={() => void reload(false)} disabled={pending}>
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

      {pending && !data && <OverviewSkeleton />}

      {data && (
        // Dimmed while a regenerate is in flight.
        <div
          className="flex flex-col gap-4 transition-opacity duration-200 data-stale:opacity-55"
          aria-busy={pending}
          data-stale={pending || undefined}
        >
          <SummarySection summary={data.overview.summary} />
          <TechStackSection techStack={data.overview.techStack} />
          <ModulesSection
            repo={data.repo}
            modules={data.overview.mainModules}
          />
          <ConventionsSection conventions={data.conventions} />
        </div>
      )}
    </div>
  );
}
