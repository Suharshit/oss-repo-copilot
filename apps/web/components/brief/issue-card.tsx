import type { Issue } from "@repo/shared/types";
import { formatRelativeTime } from "@repo/shared/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Section } from "../common/section";
import { TagList } from "../common/tag-list";
import { FriendlinessBadge } from "../issues/friendliness-badge";

interface IssueCardProps {
  issue: Issue;
}

/** The issue the brief is about: title, state, labels, and the way back to GitHub. */
export function IssueCard({ issue }: IssueCardProps) {
  const comments =
    issue.commentCount === 1 ? "1 comment" : `${issue.commentCount} comments`;
  const closed = issue.state === "closed";

  return (
    <Section
      title={`Issue #${issue.number}`}
      actions={
        <Badge
          variant="outline"
          className={closed ? "text-muted-foreground" : undefined}
        >
          {closed ? "Closed" : "Open"}
        </Badge>
      }
    >
      <h3 className="text-lg/[1.4] font-semibold wrap-anywhere">
        {issue.title}
      </h3>

      {closed && (
        <Alert>
          <AlertDescription className="text-sm">
            This issue is closed. It may already be fixed, so check the
            discussion on GitHub before you start work on it.
          </AlertDescription>
        </Alert>
      )}

      <FriendlinessBadge score={issue.friendlinessScore} />
      <TagList tags={issue.labels} label="Labels" />

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-muted-foreground">
        <span title={new Date(issue.createdAt).toLocaleString()}>
          Opened {formatRelativeTime(issue.createdAt)}
        </span>
        <span>{comments}</span>
        <a
          className="hover:text-foreground hover:underline"
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Read the full issue on GitHub ↗
        </a>
      </p>
    </Section>
  );
}
