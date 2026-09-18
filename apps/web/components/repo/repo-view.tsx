"use client";

import { useState } from "react";
import type { RepoRef } from "@repo/shared/types";
import { useRepoOverview } from "../../hooks/use-repo-overview";
import { repoPagePath, type RepoTab } from "../../lib/routes";
import { IssuesPanel } from "../issues/issues-panel";
import { RepoMeta } from "../overview/repo-meta";
import { RepoOverview } from "../overview/repo-overview";
import { RepoHeader } from "./repo-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RepoViewProps {
  repoRef: RepoRef;
  /** From `?tab=`, so a shared link opens on the tab it was copied from. */
  initialTab: RepoTab;
}

const TABS: readonly { id: RepoTab; label: string }[] = [
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
  function selectTab(value: string) {
    const next = TABS.find((item) => item.id === value)?.id;
    if (!next) return;
    setTab(next);
    if (next === "issues") setIssuesOpened(true);
    // Replace rather than push: tabs are a view of one page, not history.
    window.history.replaceState(null, "", repoPagePath(repoRef, next));
  }

  const { data, pending, reload } = overview;
  const regenerate = data && tab === "overview" && (
    <Button
      variant="outline"
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

      <Tabs value={tab} onValueChange={selectTab} className="gap-6">
        <TabsList variant="line" aria-label="Repo sections">
          {TABS.map((item) => (
            <TabsTrigger
              key={item.id}
              value={item.id}
              className="px-3 text-[0.9375rem]"
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* forceMount keeps both panels mounted, so switching never refetches;
            the inactive one is hidden with CSS instead. */}
        <TabsContent
          value="overview"
          forceMount
          className="text-base data-[state=inactive]:hidden"
        >
          <RepoOverview state={overview} />
        </TabsContent>

        <TabsContent
          value="issues"
          forceMount
          className="text-base data-[state=inactive]:hidden"
        >
          {issuesOpened && <IssuesPanel repoRef={repoRef} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
