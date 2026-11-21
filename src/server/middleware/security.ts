/** HTTP hardening: CSP and security headers, compression, rate limits, JSON-only bodies. */
import compression from 'compression';
import type { Express, NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { sendError } from '../httpErrors.js';

/** Content Security Policy: same-origin only, no inline script or style (docs/05 §2). */
export const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'"],
  imgSrc: ["'self'", 'data:'],
  fontSrc: ["'self'"],
  connectSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'none'"],
  frameAncestors: ["'none'"],
  formAction: ["'self'"],
  upgradeInsecureRequests: [],
};

/** Geolocation is allowed for this origin only ("Use my location"); everything else is off. */
export const PERMISSIONS_POLICY =
  'camera=(), microphone=(), geolocation=(self), payment=(), usb=()';

const ONE_MINUTE = 60_000;
const ONE_DAY = 86_400_000;
const GLOBAL_PER_MIN = 120;
const DATA_PER_MIN = 60;
const AI_PER_DAY = 200;

const limiter = (windowMs: number, limit: number): RequestHandler =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      sendError(res, 'rate_limited');
    },
  });

/** Helmet, extra headers, compression and the global API rate limit. */
export function applySecurity(app: Express): void {
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: { useDefaults: false, directives: CSP_DIRECTIVES },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true },
    }),
  );
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    next();
  });
  app.use(compression());
  app.use('/api', limiter(ONE_MINUTE, GLOBAL_PER_MIN));
}

/** Per-IP limits for the routes that spend model tokens: per minute and per day. */
export const aiRateLimits = (perMinute: number): RequestHandler[] => [
  limiter(ONE_MINUTE, perMinute),
  limiter(ONE_DAY, AI_PER_DAY),
];

/** Per-IP limit for the upstream data routes (geocode, air). */
export const dataRateLimit = (): RequestHandler => limiter(ONE_MINUTE, DATA_PER_MIN);

/** API responses are never cached by browsers or proxies. */
export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

/** Rejects request bodies that are not JSON (415). */
export const requireJson: RequestHandler = (req, res, next) => {
  if (req.method === 'POST' && !req.is('application/json')) {
    sendError(res, 'unsupported_media_type');
    return;
  }
  next();
};
