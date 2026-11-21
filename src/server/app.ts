/** Express app assembly: security middleware, API routes, static client and error handling. */
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import express, { type Express, type NextFunction, type Request, type Response } from 'express';

import type { AiService } from './ai/service.js';
import type { Clock } from './clock.js';
import type { Config } from './config.js';
import type { Logger } from './logger.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { sameOriginOnly } from './middleware/origin.js';
import {
  aiRateLimits,
  applySecurity,
  dataRateLimit,
  noStore,
  ONE_YEAR_SECONDS,
  requireJson,
} from './middleware/security.js';
import { setRequestId } from './requestId.js';
import { apiRouter } from './routes.js';
import type { OpenMeteo } from './upstream/openMeteo.js';

interface AppDeps {
  /** The assistant, chosen by the composition root (Gemini or rules). */
  ai: AiService;
  /** Reported by /api/health. */
  aiEnabled: boolean;
  upstream: OpenMeteo;
  clock: Clock;
  logger: Logger;
  config: Config;
  /** Directory of the built client; when set, it is served with an SPA fallback. */
  staticDir?: string | undefined;
}

const BODY_LIMIT = '16kb';

function requestLogging(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = randomUUID();
    const started = performance.now();
    setRequestId(res, requestId);
    res.on('finish', () => {
      logger.log('info', 'request', {
        requestId,
        route: req.path,
        status: res.statusCode,
        ms: Math.round(performance.now() - started),
      });
    });
    next();
  };
}

function serveClient(app: Express, staticDir: string): void {
  app.use(
    '/assets',
    express.static(path.join(staticDir, 'assets'), {
      dotfiles: 'deny',
      immutable: true,
      maxAge: ONE_YEAR_SECONDS * 1000,
    }),
  );
  app.use(express.static(staticDir, { index: false, dotfiles: 'deny' }));
  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(staticDir, 'index.html'));
  });
}

/**
 * Builds the Express app. The external dependencies (assistant, upstream fetch, clock, logger,
 * config) are injected so tests run the real app with fakes and no network.
 */
export function createApp(deps: AppDeps): Express {
  const { ai, aiEnabled, upstream, clock, logger, config } = deps;
  const app = express();
  app.use(requestLogging(logger));
  applySecurity(app);
  app.use(
    '/api',
    noStore,
    sameOriginOnly,
    requireJson,
    express.json({ limit: BODY_LIMIT, strict: true }),
  );
  app.use(
    '/api',
    apiRouter({
      upstream,
      ai,
      aiEnabled,
      clock,
      logger,
      maxEntries: config.cacheMaxEntries,
      aiLimits: aiRateLimits(config.rateLimitPerMin),
      dataLimit: dataRateLimit(),
    }),
  );
  app.use('/api', notFound);
  if (deps.staticDir) {
    serveClient(app, deps.staticDir);
  }
  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
