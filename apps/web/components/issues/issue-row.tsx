import Link from "next/link";
import type { IssueSummary, RepoRef } from "@repo/shared/types";
import { formatRelativeTime } from "@repo/shared/utils";
import { issuePagePath } from "../../lib/routes";
import { TagList } from "../common/tag-list";
import { FriendlinessBadge } from "./friendliness-badge";

interface IssueRowProps {
  repo: RepoRef;
  issue: IssueSummary;
}

/** One ranked issue. The whole row opens the issue's page; GitHub is a side link. */
export function IssueRow({ repo, issue }: IssueRowProps) {
  const comments =
    issue.commentCount === 1 ? "1 comment" : `${issue.commentCount} comments`;

  return (
    <li className="relative flex flex-col items-start gap-2 rounded-[0.625rem] border border-border bg-background p-4 transition-colors duration-150 focus-within:border-muted-foreground hover:border-muted-foreground">
      <FriendlinessBadge score={issue.friendlinessScore} />

      <h3 className="text-base/[1.4] font-medium wrap-anywhere">
        {/* Its ::after stretches over the row, so the whole card is the link,
            and carries the focus ring so it outlines the whole card. */}
        <Link
          className="outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-foreground"
          href={issuePagePath(repo, issue.number)}
        >
          <span className="font-normal text-muted-foreground">
            #{issue.number}
          </span>{" "}
          {issue.title}
        </Link>
      </h3>

      <TagList tags={issue.labels} label="Labels" />

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-muted-foreground">
        <span title={new Date(issue.createdAt).toLocaleString()}>
          Opened {formatRelativeTime(issue.createdAt)}
        </span>
        <span>{comments}</span>
        {/* Sits above the row's stretched link so it stays clickable on its own. */}
        <a
          className="relative z-1 hover:text-foreground hover:underline"
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
