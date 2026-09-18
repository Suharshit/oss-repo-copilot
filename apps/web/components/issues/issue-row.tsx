import Link from "next/link";
import type { IssueSummary, RepoRef } from "@repo/shared/types";
import { formatRelativeTime } from "@repo/shared/utils";
import { issuePagePath } from "../../lib/routes";
import { TagList } from "../common/tag-list";
import { FriendlinessBadge } from "./friendliness-badge";
import styles from "./issue-row.module.css";

interface IssueRowProps {
  repo: RepoRef;
  issue: IssueSummary;
}

/** One ranked issue. The whole row opens the issue's page; GitHub is a side link. */
export function IssueRow({ repo, issue }: IssueRowProps) {
  const comments =
    issue.commentCount === 1 ? "1 comment" : `${issue.commentCount} comments`;

  return (
    <li className={styles.row}>
      <FriendlinessBadge score={issue.friendlinessScore} />

      <h3 className={styles.title}>
        {/* Its ::after stretches over the row, so the whole card is the link. */}
        <Link className={styles.link} href={issuePagePath(repo, issue.number)}>
          <span className={styles.number}>#{issue.number}</span> {issue.title}
        </Link>
      </h3>

      <TagList tags={issue.labels} label="Labels" className={styles.labels} />

      <p className={styles.meta}>
        <span title={new Date(issue.createdAt).toLocaleString()}>
          Opened {formatRelativeTime(issue.createdAt)}
        </span>
        <span>{comments}</span>
        <a
          className={styles.github}
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub ↗
        </a>
      </p>
    </li>
  );
}
