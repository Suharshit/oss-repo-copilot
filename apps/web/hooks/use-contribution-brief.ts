"use client";

import { useCallback, useEffect, useState } from "react";
import type { BriefResponse } from "@repo/shared/types";
import { issueUrl, type IssueRef } from "@repo/shared/utils";
import { getContributionBrief } from "../lib/api";
import { toLoadError, type LoadError } from "../lib/load-error";

export interface ContributionBriefState {
  data: BriefResponse | null;
  /** Set when the last request failed. `data` may still hold an earlier result. */
  error: LoadError | null;
  /** True while a request is in flight: first load, retry or regenerate. */
  pending: boolean;
  /** Generate the brief again. Briefs aren't cached (D-06), so every call is a new one. */
  reload: () => Promise<void>;
}

/**
 * Requests in flight, by issue URL. Every brief is a paid generation that
 * counts against the caller's rate limit, and React mounts effects twice in
 * dev, so two callers asking for the same brief at once share one request.
 * The entry is removed once it settles: this is not a cache.
 */
const inFlight = new Map<string, Promise<BriefResponse>>();

function requestBrief(url: string): Promise<BriefResponse> {
  const existing = inFlight.get(url);
  if (existing) return existing;

  const request = getContributionBrief({ url }).finally(() => {
    inFlight.delete(url);
  });
  inFlight.set(url, request);
  return request;
}

/**
 * Loads an issue's contribution brief (US-3) in the browser, for the same
 * reason as useRepoOverview: the API rate-limits by client IP (OQ-2).
 */
export function useContributionBrief(ref: IssueRef): ContributionBriefState {
  const url = issueUrl(ref);
  const [data, setData] = useState<BriefResponse | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    // Drops a response that lands after the url changed or the component unmounted.
    let active = true;
    requestBrief(url)
      .then((response) => {
        if (active) setData(response);
      })
      .catch((cause: unknown) => {
        if (active) setError(toLoadError(cause, "Brief"));
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
      setData(await requestBrief(url));
    } catch (cause) {
      setError(toLoadError(cause, "Brief"));
    } finally {
      setPending(false);
    }
  }, [url]);

  return { data, error, pending, reload };
}
