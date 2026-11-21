/** Composition root: builds real dependencies from the environment for the Node server and Vercel. */
import type { Express } from 'express';

import { GeminiClient } from './ai/client.js';
import { type AiService, createGeminiService, rulesService } from './ai/service.js';
import { createApp } from './app.js';
import { type Clock, systemClock } from './clock.js';
import { type Config, loadConfig } from './config.js';
import { createLogger, type Logger } from './logger.js';
import { createOpenMeteo } from './upstream/openMeteo.js';

interface Bootstrapped {
  app: Express;
  config: Config;
  logger: Logger;
  aiEnabled: boolean;
}

/** The assistant: Gemini when a key is configured, otherwise the deterministic rules. */
function assistant(config: Config, logger: Logger, clock: Clock): AiService {
  if (!config.geminiApiKey) {
    return rulesService;
  }
  const client = new GeminiClient({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
    onUsage: (usage) => {
      logger.log('info', 'ai_usage', {
        promptTokens: usage.promptTokens,
        outputTokens: usage.outputTokens,
      });
    },
  });
  return createGeminiService({
    ai: client,
    logger,
    timeoutMs: config.aiTimeoutMs,
    maxEntries: config.cacheMaxEntries,
    now: () => clock.now().getTime(),
  });
}

/** Wires real dependencies from the environment. Shared by the Node server and the Vercel function. */
export function bootstrap(
  env: Record<string, string | undefined> = process.env,
  staticDir?: string,
): Bootstrapped {
  const config = loadConfig(env);
  const logger = createLogger();
  const aiEnabled = config.geminiApiKey !== undefined;
  const upstream = createOpenMeteo((url, init) => fetch(url, init), config.upstreamTimeoutMs);
  const ai = assistant(config, logger, systemClock);
  return {
    app: createApp({ ai, aiEnabled, upstream, clock: systemClock, logger, config, staticDir }),
    config,
    logger,
    aiEnabled,
  };
}
