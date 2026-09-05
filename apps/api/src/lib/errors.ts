import type { ApiError, ApiErrorCode, ApiSuccess } from "@repo/shared/types";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const STATUS_BY_CODE: Record<ApiErrorCode, ContentfulStatusCode> = {
  bad_request: 400,
  invalid_github_url: 400,
  not_found: 404,
  rate_limited: 429,
  upstream_error: 502,
  internal_error: 500,
};

/** Thrown anywhere in a handler; the app's onError turns it into an ApiError. */
export class HttpError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }

  get status(): ContentfulStatusCode {
    return STATUS_BY_CODE[this.code];
  }

  toResponseBody(): ApiError {
    return { ok: false, error: { code: this.code, message: this.message } };
  }
}

export function ok<T>(data: T): ApiSuccess<T> {
  return { ok: true, data };
}

export function statusForCode(code: ApiErrorCode): ContentfulStatusCode {
  return STATUS_BY_CODE[code];
}
