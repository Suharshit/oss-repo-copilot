import { ApiRequestError } from "./api";

/** An error ready to show: the API's own message, or a fallback for network failures. */
export interface LoadError {
  code: string;
  message: string;
}

/** Headings for an ErrorState, keyed by API error code. Callers may override per view. */
export const ERROR_TITLES: Record<string, string> = {
  not_found: "Repository not found",
  rate_limited: "Too many requests",
  upstream_error: "GitHub or the model didn't respond",
  invalid_github_url: "That isn't a GitHub repository",
  network_error: "Can't reach the server",
};

/** `what` names the request in the console log, e.g. "Overview". */
export function toLoadError(cause: unknown, what: string): LoadError {
  if (cause instanceof ApiRequestError) {
    return { code: cause.code, message: cause.message };
  }
  // fetch rejects with a TypeError when the API is down or CORS blocks it.
  console.error(`${what} request failed`, cause);
  return {
    code: "network_error",
    message: "Couldn't reach the server. Check your connection and try again.",
  };
}
