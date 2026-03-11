import arcjet, { detectBot, shield, tokenBucket } from "@arcjet/node";
import { isSpoofedBot } from "@arcjet/inspect";
import config from "../config.js";
import Logger from "../utils/logger.js";

const logger = new Logger("ArcjetMiddleware");
const isDev = config.nodeEnv !== "production";

// ── Arcjet environment hint ─────────────────────────────────────────
const ensureArcjetEnvironment = () => {
  const configuredEnv = String(process.env.ARCJET_ENV || "").trim();
  if (configuredEnv) return;

  if (isDev) {
    process.env.ARCJET_ENV = "development";
    logger.info('ARCJET_ENV not set; defaulting to "development" for local requests.');
  }
};

// ── Helpers ─────────────────────────────────────────────────────────
const normalizeBucket = (bucket) => {
  const refillRate = Math.max(1, Number(bucket?.refillRate || 1));
  const interval = Math.max(1, Number(bucket?.interval || 1));
  const capacity = Math.max(refillRate, Number(bucket?.capacity || refillRate));
  return { refillRate, interval, capacity };
};

// ── Client builder ──────────────────────────────────────────────────
const buildArcjetClient = () => {
  if (!config.arcjet.enabled) {
    logger.warn("Arcjet disabled via configuration.");
    return null;
  }

  if (!config.arcjet.key) {
    if (!isDev) {
      throw new Error(
        "FATAL: ARCJET_KEY is required in production. " +
        "Set ARCJET_KEY or explicitly disable with ARCJET_ENABLED=false."
      );
    }
    logger.warn("Arcjet not enabled because ARCJET_KEY is missing (acceptable in development).");
    return null;
  }

  ensureArcjetEnvironment();

  const apiBucket = normalizeBucket(config.arcjet.rateLimits.api);
  const authBucket = normalizeBucket(config.arcjet.rateLimits.auth);
  const marketBucket = normalizeBucket(config.arcjet.rateLimits.market);
  const adminBucket = normalizeBucket(config.arcjet.rateLimits.admin);

  const options = {
    key: config.arcjet.key,
    characteristics: ["ip.src"],
    rules: [
      shield({ mode: config.arcjet.mode }),
      detectBot({ mode: config.arcjet.mode, allow: ["CATEGORY:SEARCH_ENGINE"] })
    ]
  };

  if (config.arcjet.trustedProxies.length > 0) {
    options.proxies = config.arcjet.trustedProxies;
  }

  const base = arcjet(options);

  const api = base.withRule(
    tokenBucket({ mode: config.arcjet.mode, ...apiBucket })
  );
  const auth = base.withRule(
    tokenBucket({ mode: config.arcjet.mode, ...authBucket })
  );
  const market = base.withRule(
    tokenBucket({ mode: config.arcjet.mode, ...marketBucket })
  );
  const admin = base.withRule(
    tokenBucket({ mode: config.arcjet.mode, ...adminBucket })
  );

  logger.info("Arcjet protection enabled.", {
    mode: config.arcjet.mode,
    failClosed: config.arcjet.failClosed,
    trustedProxies: config.arcjet.trustedProxies.length,
    apiBucket,
    authBucket,
    marketBucket,
    adminBucket
  });

  return { base, api, auth, market, admin };
};

const clients = buildArcjetClient();

// ── Rate-limit response headers ─────────────────────────────────────
const setRateLimitHeaders = (res, reason) => {
  const retryAfter = Math.max(1, Number(reason.reset || 1));
  const resetEpoch = reason.resetTime instanceof Date
    ? Math.floor(reason.resetTime.getTime() / 1000)
    : Math.floor(Date.now() / 1000) + retryAfter;

  res.set("Retry-After", String(retryAfter));
  res.set("X-RateLimit-Limit", String(reason.max));
  res.set("X-RateLimit-Remaining", String(Math.max(0, reason.remaining)));
  res.set("X-RateLimit-Reset", String(resetEpoch));
};

// ── Deny handler ────────────────────────────────────────────────────
const handleDecisionDeny = (req, res, decision, scope) => {
  if (decision.reason.isRateLimit()) {
    setRateLimitHeaders(res, decision.reason);
    logger.warn("Arcjet rate limit deny", {
      scope,
      path: req.path,
      method: req.method,
      ip: req.ip,
      remaining: decision.reason.remaining,
      reset: decision.reason.reset
    });
    return res.status(429).json({
      error: "Too many requests. Please try again shortly."
    });
  }

  if (decision.reason.isBot()) {
    const spoofed = decision.results.some((result) => isSpoofedBot(result) === true);
    logger.warn("Arcjet bot deny", {
      scope,
      path: req.path,
      method: req.method,
      ip: req.ip,
      spoofed,
      verified: decision.reason.isVerified()
    });
    return res.status(403).json({
      error: spoofed ? "Spoofed bot traffic is not allowed." : "Automated traffic is not allowed."
    });
  }

  logger.warn("Arcjet shield deny", {
    scope,
    path: req.path,
    method: req.method,
    ip: req.ip,
    reason: decision.reason.type
  });
  return res.status(403).json({ error: "Request blocked by security policy." });
};

// ── Core middleware factory ──────────────────────────────────────────
const createArcjetMiddleware = (client, scope) => {
  if (!client) {
    return (_req, _res, next) => next();
  }

  return async (req, res, next) => {
    if (req.method === "OPTIONS") {
      return next();
    }

    try {
      const decision = await client.protect(req, { requested: 1 });

      // ── DENIED ──
      if (decision.isDenied()) {
        if (isDev && config.arcjet.mode === "DRY_RUN") {
          // In dev DRY_RUN: log what would be blocked, but allow through
          logger.warn("Arcjet would deny (dry-run)", {
            scope,
            path: req.path,
            ip: req.ip,
            reason: decision.reason.type
          });
          return next();
        }
        return handleDecisionDeny(req, res, decision, scope);
      }

      // ── ERRORED (e.g. missing public IP on localhost) ──
      if (decision.isErrored()) {
        if (isDev) {
          // Graceful degradation: log once-per-scope style, never block
          logger.debug("Arcjet decision errored in development (expected on localhost)", {
            scope,
            ip: req.ip,
            reason: decision.reason?.message || decision.reason?.type
          });
          return next();
        }

        // Production: respect failClosed setting
        logger.error("Arcjet decision errored", {
          scope,
          path: req.path,
          method: req.method,
          ip: req.ip,
          reason: decision.reason?.message || decision.reason?.type
        });

        if (config.arcjet.failClosed) {
          return res.status(503).json({ error: "Security checks unavailable. Please retry." });
        }
      }

      return next();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (isDev) {
        logger.debug("Arcjet middleware exception in development", {
          scope,
          error: errorMsg
        });
        return next();
      }

      // Production: never silently swallow
      logger.error("Arcjet middleware failed", {
        scope,
        path: req.path,
        method: req.method,
        ip: req.ip,
        error: errorMsg
      });

      if (config.arcjet.failClosed) {
        return res.status(503).json({ error: "Security checks unavailable. Please retry." });
      }

      return next();
    }
  };
};

// ── Exports ─────────────────────────────────────────────────────────
export const arcjetApiProtection = createArcjetMiddleware(clients?.base, "api");
export const arcjetRateLimitApiProtection = createArcjetMiddleware(clients?.api, "api-rate-limit");
export const arcjetAuthProtection = createArcjetMiddleware(clients?.auth, "auth");
export const arcjetMarketProtection = createArcjetMiddleware(clients?.market, "market");
export const arcjetAdminProtection = createArcjetMiddleware(clients?.admin, "admin");
