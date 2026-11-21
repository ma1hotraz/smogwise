/** Environment configuration, validated with zod; secrets are never printed. */
import * as z from 'zod/mini';

const positiveInt = (fallback: number) =>
  z._default(z.pipe(z.coerce.number(), z.int().check(z.positive())), fallback);

const ConfigSchema = z.object({
  PORT: positiveInt(8080),
  GEMINI_API_KEY: z.optional(z.string().check(z.trim())),
  GEMINI_MODEL: z._default(z.string().check(z.trim(), z.minLength(1)), 'gemini-3.5-flash-lite'),
  AI_TIMEOUT_MS: positiveInt(10_000),
  UPSTREAM_TIMEOUT_MS: positiveInt(5_000),
  RATE_LIMIT_PER_MIN: positiveInt(10),
  CACHE_MAX_ENTRIES: positiveInt(500),
});

export interface Config {
  port: number;
  /** Never logged or returned to clients. */
  geminiApiKey: string | undefined;
  geminiModel: string;
  aiTimeoutMs: number;
  upstreamTimeoutMs: number;
  rateLimitPerMin: number;
  cacheMaxEntries: number;
}

/**
 * Parses and validates environment variables, failing fast. The error names the offending
 * variables but never prints their values (the key must stay secret).
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Invalid configuration: ${names.join(', ')}`);
  }
  const data = parsed.data;
  return {
    port: data.PORT,
    geminiApiKey: data.GEMINI_API_KEY === '' ? undefined : data.GEMINI_API_KEY,
    geminiModel: data.GEMINI_MODEL,
    aiTimeoutMs: data.AI_TIMEOUT_MS,
    upstreamTimeoutMs: data.UPSTREAM_TIMEOUT_MS,
    rateLimitPerMin: data.RATE_LIMIT_PER_MIN,
    cacheMaxEntries: data.CACHE_MAX_ENTRIES,
  };
}
