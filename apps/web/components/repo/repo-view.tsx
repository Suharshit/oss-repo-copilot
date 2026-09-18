"use client";

import { useId, useState } from "react";
import type { RepoRef } from "@repo/shared/types";
import { Button } from "@repo/shared/ui/button";
import { useRepoOverview } from "../../hooks/use-repo-overview";
import { repoPagePath, type RepoTab } from "../../lib/routes";
import { tabId, tabPanelId, Tabs, type TabItem } from "../common/tabs";
import { IssuesPanel } from "../issues/issues-panel";
import { RepoMeta } from "../overview/repo-meta";
import { RepoOverview } from "../overview/repo-overview";
import { RepoHeader } from "./repo-header";

interface RepoViewProps {
  repoRef: RepoRef;
  /** From `?tab=`, so a shared link opens on the tab it was copied from. */
  initialTab: RepoTab;
}

const TABS: readonly TabItem<RepoTab>[] = [
  { id: "overview", label: "Overview" },
  { id: "issues", label: "Issues" },
];

/**
 * A repo page: header, then Overview and Issues tabs. The overview loads on
 * arrival because the header shows its meta. The issue list loads the first
 * time its tab opens, and both stay mounted after that, so switching back and
 * forth never refetches.
 */
export function RepoView({ repoRef, initialTab }: RepoViewProps) {
  const overview = useRepoOverview(repoRef);
  const [tab, setTab] = useState<RepoTab>(initialTab);
  const [issuesOpened, setIssuesOpened] = useState(initialTab === "issues");
  const idPrefix = useId();

  function selectTab(next: RepoTab) {
    setTab(next);
    if (next === "issues") setIssuesOpened(true);
    // Replace rather than push: tabs are a view of one page, not history.
    window.history.replaceState(null, "", repoPagePath(repoRef, next));
  }

  const { data, pending, reload } = overview;
  const regenerate = data && tab === "overview" && (
    <Button
      variant="secondary"
      onClick={() => void reload(true)}
      disabled={pending}
      title="Skip the cached overview and generate a new one"
    >
      {pending ? "Regenerating…" : "Regenerate"}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <RepoHeader
        repo={repoRef}
        meta={data && <RepoMeta response={data} />}
        actions={regenerate}
      />

      <Tabs
        tabs={TABS}
        active={tab}
        onChange={selectTab}
        label="Repo sections"
        idPrefix={idPrefix}
      />

      <div
        role="tabpanel"
        id={tabPanelId(idPrefix, "overview")}
        aria-labelledby={tabId(idPrefix, "overview")}
        hidden={tab !== "overview"}
      >
        <RepoOverview state={overview} />
      </div>

      <div
        role="tabpanel"
        id={tabPanelId(idPrefix, "issues")}
        aria-labelledby={tabId(idPrefix, "issues")}
        hidden={tab !== "issues"}
      >
        {issuesOpened && <IssuesPanel repoRef={repoRef} />}
      </div>
    </div>
  );
}
