import { GOOD_FIRST_ISSUE_LABEL } from "@repo/shared/constants";
import type { IssuesResponse, RepoRef } from "@repo/shared/types";
import { Section } from "../common/section";
import { IssueRow } from "./issue-row";
import styles from "./issue-list.module.css";

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
          <span className={styles.count}>{issues.length}</span>
        )
      }
    >
      {/* Without the label the ranking leans on comments and age alone, so say so. */}
      {!labelled && issues.length > 0 && (
        <p className={styles.notice}>
          Nothing here is labelled “{GOOD_FIRST_ISSUE_LABEL}”, so these are the
          most recent open issues, ranked by how approachable they look.
        </p>
      )}

      {issues.length > 0 ? (
        <ol className={styles.list}>
          {issues.map((issue) => (
            <IssueRow key={issue.number} repo={repo} issue={issue} />
          ))}
        </ol>
      ) : (
        <p className={styles.notice}>This repo has no open issues right now.</p>
      )}
    </Section>
  );
}
