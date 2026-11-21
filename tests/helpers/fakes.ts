/** Fakes for the injected server dependencies: no network, no model, fixed clock. */
import { buildContext } from '../../src/shared/ai/context.js';
import { buildPlan } from '../../src/shared/engine/plan.js';
import type { AiContext } from '../../src/shared/schema/ai.js';
import type { AiClient, GenerateArgs } from '../../src/server/ai/client.js';
import { createGeminiService, rulesService } from '../../src/server/ai/service.js';
import { createApp } from '../../src/server/app.js';
import type { Config } from '../../src/server/config.js';
import type { Logger, LogFields } from '../../src/server/logger.js';
import { createOpenMeteo, type FetchFn } from '../../src/server/upstream/openMeteo.js';
import { NOW, sample, winterAir } from './fixtures.js';

/** A scripted model: each call returns (or throws) the next item; records every call. */
export class FakeAi implements AiClient {
  readonly calls: GenerateArgs[] = [];
  constructor(private readonly script: unknown[] = []) {}

  generateJson(args: GenerateArgs): Promise<unknown> {
    this.calls.push(args);
    const next = this.script.length > 1 ? this.script.shift() : this.script[0];
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  }
}

interface Captured {
  level: string;
  msg: string;
  fields: LogFields;
}

/** A logger that discards everything. */
export const silentLogger: Logger = { log: () => undefined };

export function captureLogger(): Logger & { lines: Captured[] } {
  const lines: Captured[] = [];
  return { lines, log: (level, msg, fields = {}) => lines.push({ level, msg, fields }) };
}

const GEOCODE_BODY = {
  results: [
    {
      name: 'Delhi',
      latitude: 28.65195,
      longitude: 77.23149,
      country_code: 'IN',
      timezone: 'Asia/Kolkata',
      admin1: 'National Capital Territory of Delhi',
    },
    {
      name: 'Delhi',
      latitude: 42.27814,
      longitude: -74.91599,
      country_code: 'US',
      timezone: 'America/New_York',
      admin1: 'New York',
    },
    { name: '<script>', latitude: 1, longitude: 1, country_code: 'XX', timezone: 'UTC' },
  ],
};

export function airBody(
  values: readonly (number | null)[] = Array.from({ length: 48 }, (_, i) => 100 + i),
) {
  const start = Date.parse('2026-11-20T00:00:00Z');
  return {
    timezone: 'Asia/Kolkata',
    hourly: {
      time: values.map(
        (_, i) => new Date(start + i * 3_600_000).toISOString().slice(0, 13) + ':00',
      ),
      pm2_5: values,
      pm10: values.map((v) => (v === null ? null : v * 1.5)),
    },
  };
}

type Handler = () => Response | Promise<Response>;

/** Routes fake fetches by host; records requested URLs. */
export function fakeFetch(
  handlers: { geocode?: Handler; air?: Handler } = {},
): FetchFn & { urls: URL[] } {
  const urls: URL[] = [];
  const fn = (url: URL): Promise<Response> => {
    urls.push(url);
    const geocoding = url.host.startsWith('geocoding');
    const handler = geocoding ? handlers.geocode : handlers.air;
    return Promise.resolve(
      handler ? handler() : Response.json(geocoding ? GEOCODE_BODY : airBody()),
    );
  };
  return Object.assign(fn, { urls });
}

const TEST_CONFIG: Config = {
  port: 0,
  geminiApiKey: undefined,
  geminiModel: 'test-model',
  aiTimeoutMs: 1000,
  upstreamTimeoutMs: 1000,
  rateLimitPerMin: 10,
  cacheMaxEntries: 50,
};

export function makeApp(
  options: {
    ai?: AiClient;
    fetch?: FetchFn;
    logger?: Logger;
    config?: Partial<Config>;
    staticDir?: string;
  } = {},
) {
  const config = { ...TEST_CONFIG, ...options.config };
  const logger = options.logger ?? captureLogger();
  // A model client means the Gemini service; none means the rules service, as in bootstrap.ts.
  const ai = options.ai
    ? createGeminiService({
        ai: options.ai,
        logger,
        timeoutMs: config.aiTimeoutMs,
        maxEntries: config.cacheMaxEntries,
        now: () => NOW.getTime(),
      })
    : rulesService;
  return createApp({
    ai,
    aiEnabled: options.ai !== undefined,
    upstream: createOpenMeteo(options.fetch ?? fakeFetch(), 1000),
    clock: { now: () => NOW },
    logger,
    config,
    staticDir: options.staticDir,
  });
}

/** The AI context for the Sharma household on a winter morning. */
export function sharmaContext(): AiContext {
  const profile = sample('sharma');
  return buildContext(buildPlan(profile, winterAir(), NOW), profile);
}
