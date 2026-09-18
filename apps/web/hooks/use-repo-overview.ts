"use client";

import { useCallback, useEffect, useState } from "react";
import type { OverviewResponse, RepoRef } from "@repo/shared/types";
import { repoUrl } from "@repo/shared/utils";
import { getRepoOverview } from "../lib/api";
import { toLoadError, type LoadError } from "../lib/load-error";

export interface RepoOverviewState {
  data: OverviewResponse | null;
  /** Set when the last request failed. `data` may still hold an earlier result. */
  error: LoadError | null;
  /** True while any request is in flight: first load, retry or regenerate. */
  pending: boolean;
  /** Re-request the overview; `refresh` skips the API's cache (spec §6). */
  reload: (refresh: boolean) => Promise<void>;
}

/**
 * Loads a repo overview in the browser, not on the Next server. The API limits
 * by client IP (OQ-2), so a server-side fetch would put every visitor in one bucket.
 */
export function useRepoOverview(ref: RepoRef): RepoOverviewState {
  const url = repoUrl(ref);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    // Guards against a stale response landing after the url changed or the
    // component unmounted (React strict mode mounts twice in dev).
    let active = true;
    getRepoOverview({ url })
      .then((response) => {
        if (active) setData(response);
      })
      .catch((cause: unknown) => {
        if (active) setError(toLoadError(cause, "Overview"));
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [url]);

  const reload = useCallback(
    async (refresh: boolean) => {
      setPending(true);
      setError(null);
      try {
        setData(await getRepoOverview({ url, refresh }));
      } catch (cause) {
        setError(toLoadError(cause, "Overview"));
      } finally {
        setPending(false);
      }
    },
    [url],
  );

  return { data, error, pending, reload };
}
