import type { OverviewResponse } from "@repo/shared/types";
import { formatRelativeTime } from "@repo/shared/utils";

interface RepoMetaProps {
  response: OverviewResponse;
}

/** Facts shown under the repo title. Rendered inside RepoHeader's `meta` slot. */
export function RepoMeta({ response }: RepoMetaProps) {
  const { repo, overview, cached } = response;

  return (
    <>
      {repo.primaryLanguage && <span>{repo.primaryLanguage}</span>}
      <span>
        Branch <code>{repo.defaultBranch}</code>
      </span>
      <span title={new Date(overview.generatedAt).toLocaleString()}>
        {cached ? "Cached overview" : "Generated"},{" "}
        {formatRelativeTime(overview.generatedAt)}
      </span>
    </>
  );
}
