import type { ErrorRequestHandler, RequestHandler } from 'express';

import type { Logger } from '../logger.js';
import { requestIdOf } from '../requestId.js';

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'not_found' });
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
      res.status(413).json({ error: 'payload_too_large' });
      return;
    }
    if (clientError === 400) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }
    const requestId = requestIdOf(res);
    logger.log('error', 'unhandled_error', {
      requestId,
      reason: error instanceof Error ? error.name : 'unknown',
    });
    res.status(500).json({ error: 'internal_error', requestId });
  };
