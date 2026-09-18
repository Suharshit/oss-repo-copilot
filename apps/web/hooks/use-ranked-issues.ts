"use client";

import { useCallback, useEffect, useState } from "react";
import type { IssuesResponse, RepoRef } from "@repo/shared/types";
import { repoUrl } from "@repo/shared/utils";
import { getRankedIssues } from "../lib/api";
import { toLoadError, type LoadError } from "../lib/load-error";

export interface RankedIssuesState {
  data: IssuesResponse | null;
  /** Set when the last request failed. `data` may still hold an earlier result. */
  error: LoadError | null;
  /** True while a request is in flight: first load or retry. */
  pending: boolean;
  /** Re-request the list. There is no cache to skip yet, so it takes no flag. */
  reload: () => Promise<void>;
}

/**
 * Loads a repo's ranked issues (US-2) in the browser, for the same reason as
 * useRepoOverview: the API rate-limits by client IP (OQ-2).
 */
export function useRankedIssues(ref: RepoRef): RankedIssuesState {
  const url = repoUrl(ref);
  const [data, setData] = useState<IssuesResponse | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    // Drops a response that lands after the url changed or the component unmounted.
    let active = true;
    getRankedIssues(url)
      .then((response) => {
        if (active) setData(response);
      })
      .catch((cause: unknown) => {
        if (active) setError(toLoadError(cause, "Issues"));
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [url]);

  const reload = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      setData(await getRankedIssues(url));
    } catch (cause) {
      setError(toLoadError(cause, "Issues"));
    } finally {
      setPending(false);
    }
  }, [url]);

  return { data, error, pending, reload };
}
