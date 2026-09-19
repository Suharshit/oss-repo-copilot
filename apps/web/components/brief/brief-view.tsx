"use client";

import Link from "next/link";
import { GENERATION_RATE_LIMIT } from "@repo/shared/constants";
import { formatRelativeTime, type IssueRef } from "@repo/shared/utils";
import { Button } from "@/components/ui/button";
import { useContributionBrief } from "../../hooks/use-contribution-brief";
import { ERROR_TITLES } from "../../lib/load-error";
import { repoPagePath } from "../../lib/routes";
import { ErrorState } from "../common/error-state";
import { ConventionsSection } from "../overview/conventions-section";
import { RepoHeader } from "../repo/repo-header";
import { ApproachSection } from "./approach-section";
import { BriefSkeleton } from "./brief-skeleton";
import { IssueCard } from "./issue-card";
import { RelevantFilesSection } from "./relevant-files-section";

interface BriefViewProps {
  issueRef: IssueRef;
}

/**
 * On this page a 404 is usually about the issue: a wrong number, or a pull
 * request, which the API's message says in so many words.
 */
const BRIEF_ERROR_TITLES: Record<string, string> = {
  ...ERROR_TITLES,
  not_found: "Couldn't find that issue",
};

const REGENERATE_HINT =
  `Write a new brief. Each one counts toward your limit of ` +
  `${GENERATION_RATE_LIMIT.limit} generations every ` +
  `${GENERATION_RATE_LIMIT.windowMs / 60_000} minutes.`;

/**
 * US-3: an issue's contribution brief. Owns the header too, like RepoView,
 * because Regenerate sits in it.
 */
export function BriefView({ issueRef }: BriefViewProps) {
  const { data, error, pending, reload } = useContributionBrief(issueRef);

  const regenerate = data && (
    <Button
      variant="outline"
      onClick={() => void reload()}
      disabled={pending}
      title={REGENERATE_HINT}
    >
      {pending ? "Regenerating…" : "Regenerate"}
    </Button>
  );

  const meta = data && (
    <span title={new Date(data.brief.generatedAt).toLocaleString()}>
      Brief written {formatRelativeTime(data.brief.generatedAt)} by an AI model.
      Check it against the code.
    </span>
  );

  return (
    <div className="flex flex-col gap-6">
      <RepoHeader repo={issueRef} meta={meta} actions={regenerate} />

      <div className="flex flex-col gap-4">
        {/* A failed regenerate keeps the old brief on screen below the error. */}
        {error && (
          <ErrorState
            title={BRIEF_ERROR_TITLES[error.code] ?? "Something went wrong"}
            message={error.message}
            actions={
              <>
                {/* Retrying a missing issue can't succeed, so it only offers a way out. */}
                {error.code !== "not_found" && (
                  <Button onClick={() => void reload()} disabled={pending}>
                    Try again
                  </Button>
                )}
                <Link
                  href={repoPagePath(issueRef, "issues")}
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  Pick another issue
                </Link>
              </>
            }
          />
        )}

        {pending && !data && <BriefSkeleton number={issueRef.number} />}

        {data && (
          // Dimmed while a regenerate is in flight.
          <div
            className="flex flex-col gap-4 transition-opacity duration-200 data-stale:opacity-55"
            aria-busy={pending}
            data-stale={pending || undefined}
          >
            <IssueCard issue={data.issue} />
            <RelevantFilesSection
              repo={data.repo}
              files={data.brief.relevantFiles}
            />
            <ApproachSection approach={data.brief.suggestedApproach} />
            <ConventionsSection conventions={data.conventions} />
          </div>
        )}
      </div>
    </div>
  );
}
