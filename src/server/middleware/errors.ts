/** Not-found and central error handlers: generic JSON bodies, details only in logs. */
import type { ErrorRequestHandler, RequestHandler } from 'express';

import { sendError } from '../httpErrors.js';
import type { Logger } from '../logger.js';
import { requestIdOf } from '../requestId.js';

/** 404 for any route that matched nothing. */
export const notFound: RequestHandler = (_req, res) => {
  sendError(res, 'not_found');
};

/** Classifies body-parser failures; anything else is an internal error. */
function clientErrorOf(error: unknown): 413 | 400 | null {
  const obj = typeof error === 'object' && error !== null ? error : {};
  const type = 'type' in obj && typeof obj.type === 'string' ? obj.type : undefined;
  const status = 'status' in obj && typeof obj.status === 'number' ? obj.status : undefined;
  if (type === 'entity.too.large') {
    return 413;
  }
  return type === 'entity.parse.failed' || status === 400 ? 400 : null;
}

/**
 * Central error handler. Maps body-parser failures to 400/413 and everything else to a generic
 * 500 with a request id. Stack traces and error text are logged by name only, never sent.
 */
export const errorHandler =
  (logger: Logger): ErrorRequestHandler =>
  (error: unknown, _req, res, _next) => {
    const clientError = clientErrorOf(error);
    if (clientError === 413) {
      sendError(res, 'payload_too_large');
      return;
    }
    if (clientError === 400) {
      sendError(res, 'invalid_request');
      return;
    }
    const requestId = requestIdOf(res);
    logger.log('error', 'unhandled_error', {
      requestId,
      reason: error instanceof Error ? error.name : 'unknown',
    });
    sendError(res, 'internal_error', { requestId });
  };
