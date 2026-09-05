import { API_ROUTES, DEFAULT_API_PORT } from "@repo/shared/constants";
import type {
  ApiResponse,
  BriefRequest,
  BriefResponse,
  IssuesResponse,
  OverviewRequest,
  OverviewResponse,
} from "@repo/shared/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:${DEFAULT_API_PORT}`;

/** Thrown with the API's own error code so callers can branch on it. */
export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export function getRepoOverview(
  body: OverviewRequest,
): Promise<OverviewResponse> {
  return request<OverviewResponse>(API_ROUTES.overview, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getRankedIssues(repoUrl: string): Promise<IssuesResponse> {
  const query = new URLSearchParams({ url: repoUrl });
  return request<IssuesResponse>(`${API_ROUTES.issues}?${query}`);
}

export function getContributionBrief(
  body: BriefRequest,
): Promise<BriefResponse> {
  return request<BriefResponse>(API_ROUTES.brief, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) {
    throw new ApiRequestError(payload.error.code, payload.error.message);
  }
  return payload.data;
}
