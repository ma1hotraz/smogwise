/** Composition root: builds real dependencies from the environment for the Node server and Vercel. */
import type { Express } from 'express';

import { DisabledAiClient, GeminiClient, type AiClient } from './ai/client.js';
import { createApp } from './app.js';
import { systemClock } from './clock.js';
import { loadConfig, type Config } from './config.js';
import { createLogger, type Logger } from './logger.js';
import { createOpenMeteo } from './upstream/openMeteo.js';

interface Bootstrapped {
  app: Express;
  config: Config;
  logger: Logger;
  ai: AiClient;
}

/**
 * Wires real dependencies from the environment: Gemini when a key is set, otherwise the
 * deterministic answers. Shared by the Node server and the Vercel function.
 */
export function bootstrap(
  env: Record<string, string | undefined> = process.env,
  staticDir?: string,
): Bootstrapped {
  const config = loadConfig(env);
  const logger = createLogger();
  const ai: AiClient = config.geminiApiKey
    ? new GeminiClient({
        apiKey: config.geminiApiKey,
        model: config.geminiModel,
        onUsage: (usage) => {
          logger.log('info', 'ai_usage', {
            promptTokens: usage.promptTokens,
            outputTokens: usage.outputTokens,
          });
        },
      })
    : new DisabledAiClient();
  const upstream = createOpenMeteo((url, init) => fetch(url, init), config.upstreamTimeoutMs);
  return {
    app: createApp({ ai, upstream, clock: systemClock, logger, config, staticDir }),
    config,
    logger,
    ai,
  };
}
