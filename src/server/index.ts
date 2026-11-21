/** Node entry: starts the HTTP server with timeouts and graceful shutdown. */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { bootstrap } from './bootstrap.js';

const SHUTDOWN_GRACE_MS = 10_000;
const REQUEST_TIMEOUT_MS = 30_000;
const HEADERS_TIMEOUT_MS = 10_000;

const here = path.dirname(fileURLToPath(import.meta.url));
// The bundled server sits next to the built client in dist/; in development Vite serves it.
const clientDir = path.resolve(here, 'client');
const { app, config, logger, aiEnabled } = bootstrap(
  process.env,
  existsSync(path.join(clientDir, 'index.html')) ? clientDir : undefined,
);

const server = app.listen(config.port, '0.0.0.0', () => {
  logger.log('info', 'listening', { port: config.port, ai: aiEnabled ? 'enabled' : 'disabled' });
});
server.requestTimeout = REQUEST_TIMEOUT_MS;
server.headersTimeout = HEADERS_TIMEOUT_MS;

process.on('SIGTERM', () => {
  logger.log('info', 'shutdown');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
});
