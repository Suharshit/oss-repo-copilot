"use client";

import Link from "next/link";
import type { RepoRef } from "@repo/shared/types";
import { Button } from "@repo/shared/ui/button";
import { useRepoOverview } from "../../hooks/use-repo-overview";
import { ErrorState } from "../common/error-state";
import { ConventionsSection } from "./conventions-section";
import { ModulesSection } from "./modules-section";
import { OverviewSkeleton } from "./overview-skeleton";
import { RepoHeader } from "./repo-header";
import { RepoMeta } from "./repo-meta";
import { SummarySection } from "./summary-section";
import { TechStackSection } from "./tech-stack-section";
import styles from "./repo-overview.module.css";

interface RepoOverviewProps {
  repoRef: RepoRef;
}

const ERROR_TITLES: Record<string, string> = {
  not_found: "Repository not found",
  rate_limited: "Too many requests",
  upstream_error: "GitHub or the model didn't respond",
  invalid_github_url: "That isn't a GitHub repository",
  network_error: "Can't reach the server",
};

/** US-1: the overview half of a repo page. Owns the loading, error and regenerate states. */
export function RepoOverview({ repoRef }: RepoOverviewProps) {
  const { data, error, pending, reload } = useRepoOverview(repoRef);

  const regenerate = (
    <Button
      variant="secondary"
      onClick={() => void reload(true)}
      disabled={pending || !data}
      title="Skip the cached overview and generate a new one"
    >
      {pending && data ? "Regenerating…" : "Regenerate"}
    </Button>
  );

  const errorState = error && (
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
          <Link href="/" className={styles.backLink}>
            Try another repo
          </Link>
        </>
      }
    />
  );

  return (
    <div className={styles.stack}>
      <RepoHeader
        repo={repoRef}
        meta={data && <RepoMeta response={data} />}
        actions={data && regenerate}
      />

      {/* A failed regenerate keeps the old overview on screen below the error. */}
      {errorState}

      {pending && !data && <OverviewSkeleton />}

      {data && (
        <div
          className={styles.sections}
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
