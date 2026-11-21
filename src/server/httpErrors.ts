/** Every error code the API returns, with its HTTP status, so routes and middleware agree. */
import type { Response } from 'express';

const HTTP_ERRORS = {
  invalid_request: 400,
  forbidden_origin: 403,
  not_found: 404,
  payload_too_large: 413,
  unsupported_media_type: 415,
  rate_limited: 429,
  internal_error: 500,
  upstream_unavailable: 502,
} as const;

type HttpErrorCode = keyof typeof HTTP_ERRORS;

/** Sends `{ error: code, ...extra }` with the code's status. Never includes internal details. */
export function sendError(
  res: Response,
  code: HttpErrorCode,
  extra: Record<string, string> = {},
): void {
  res.status(HTTP_ERRORS[code]).json({ error: code, ...extra });
}
