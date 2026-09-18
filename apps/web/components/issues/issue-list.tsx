import { GOOD_FIRST_ISSUE_LABEL } from "@repo/shared/constants";
import type { IssuesResponse, RepoRef } from "@repo/shared/types";
import { Section } from "../common/section";
import { IssueRow } from "./issue-row";

interface IssueListProps {
  repo: RepoRef;
  response: IssuesResponse;
}

/** US-2: the ranked list, most approachable first (the API has already sorted it). */
export function IssueList({ repo, response }: IssueListProps) {
  const { issues, source } = response;
  const labelled = source === "labelled";

  return (
    <Section
      title={labelled ? "Good first issues" : "Open issues"}
      actions={
        issues.length > 0 && (
          <span className="text-[0.8125rem] text-muted">{issues.length}</span>
        )
      }
    >
      {/* Without the label the ranking leans on comments and age alone, so say so. */}
      {!labelled && issues.length > 0 && (
        <p className="text-sm/normal text-muted">
          Nothing here is labelled “{GOOD_FIRST_ISSUE_LABEL}”, so these are the
          most recent open issues, ranked by how approachable they look.
        </p>
      )}

      {issues.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {issues.map((issue) => (
            <IssueRow key={issue.number} repo={repo} issue={issue} />
          ))}
        </ol>
      ) : (
        <p className="text-sm/normal text-muted">
          This repo has no open issues right now.
        </p>
      )}
    </Section>
  );
}
