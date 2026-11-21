/** HTTP routes (docs/02 §5). Every input is parsed with zod before use. */
import { Router, type RequestHandler, type Response } from 'express';
import type * as z from 'zod/mini';

import { AskRequest, BriefRequest } from '../shared/schema/ai.js';
import { AirQuery, GeocodeQuery, roundCoord, type AirData } from '../shared/schema/air.js';
import type { AiService } from './ai/service.js';
import { TtlCache } from './cache.js';
import type { Clock } from './clock.js';
import type { Logger } from './logger.js';
import { UpstreamError, type OpenMeteo } from './upstream/openMeteo.js';
import { sendError } from './httpErrors.js';
import type { Location } from '../shared/schema/profile.js';

const AIR_TTL_MS = 30 * 60_000;
const GEOCODE_TTL_MS = 24 * 60 * 60_000;
/** Version of the HTTP API contract (docs/02 §5), reported by /api/health. */
const API_VERSION = '1.0.0';

/** What the upstream data routes need. */
interface DataRouteDeps {
  upstream: OpenMeteo;
  clock: Clock;
  logger: Logger;
  maxEntries: number;
  dataLimit: RequestHandler;
}

/** What the assistant routes need. */
interface AiRouteDeps {
  ai: AiService;
  aiLimits: RequestHandler[];
}

type RouteDeps = DataRouteDeps & AiRouteDeps & { aiEnabled: boolean };

/** Parses `value` or answers 400 with a generic body; returns undefined when it answered. */
function parse<T>(schema: z.ZodMiniType<T>, value: unknown, res: Response): T | undefined {
  const result = schema.safeParse(value);
  if (!result.success) {
    sendError(res, 'invalid_request');
    return undefined;
  }
  return result.data;
}

/** Runs an upstream call, mapping failures to a generic 502 without details. */
async function upstreamOr502<T>(
  res: Response,
  logger: Logger,
  run: () => Promise<T>,
): Promise<void> {
  try {
    res.json(await run());
  } catch (error) {
    const reason = error instanceof UpstreamError ? error.message : 'unknown';
    logger.log('warn', 'upstream_failed', { reason });
    sendError(res, 'upstream_unavailable');
  }
}

/** GET /geocode and /air: validated, cached, rate-limited upstream proxies. */
function dataRoutes(router: Router, deps: DataRouteDeps): void {
  const now = (): number => deps.clock.now().getTime();
  const air = new TtlCache<AirData>(deps.maxEntries, AIR_TTL_MS, now);
  const places = new TtlCache<Location[]>(deps.maxEntries, GEOCODE_TTL_MS, now);

  router.get('/geocode', deps.dataLimit, async (req, res) => {
    const query = parse(GeocodeQuery, req.query, res);
    if (query) {
      await upstreamOr502(res, deps.logger, async () => ({
        results: await places.load(query.q.toLowerCase(), () => deps.upstream.geocode(query.q)),
      }));
    }
  });

  router.get('/air', deps.dataLimit, async (req, res) => {
    const query = parse(AirQuery, req.query, res);
    if (query) {
      const lat = roundCoord(query.lat);
      const lon = roundCoord(query.lon);
      await upstreamOr502(res, deps.logger, () =>
        air.load(`${lat},${lon}`, () => deps.upstream.air(lat, lon, deps.clock.now())),
      );
    }
  });
}

/** POST /brief and /ask: validated and rate-limited; the service never throws. */
function aiRoutes(router: Router, deps: AiRouteDeps): void {
  router.post('/brief', ...deps.aiLimits, async (req, res) => {
    const body = parse(BriefRequest, req.body, res);
    if (body) {
      res.json(await deps.ai.brief(body.context));
    }
  });

  router.post('/ask', ...deps.aiLimits, async (req, res) => {
    const body = parse(AskRequest, req.body, res);
    if (body) {
      res.json(await deps.ai.ask(body));
    }
  });
}

/** Builds the API router. */
export function apiRouter(deps: RouteDeps): Router {
  const router = Router();
  router.get('/health', (_req, res) => {
    res.json({ ok: true, ai: deps.aiEnabled ? 'enabled' : 'disabled', version: API_VERSION });
  });
  dataRoutes(router, deps);
  aiRoutes(router, deps);
  return router;
}
