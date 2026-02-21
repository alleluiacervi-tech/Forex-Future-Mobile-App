import arcjet, { detectBot, shield, tokenBucket } from "@arcjet/node";
import { isSpoofedBot } from "@arcjet/inspect";
import config from "../config.js";
import Logger from "../utils/logger.js";

const logger = new Logger("ArcjetMiddleware");

const normalizeBucket = (bucket) => {
  const refillRate = Math.max(1, Number(bucket?.refillRate || 1));
  const interval = Math.max(1, Number(bucket?.interval || 1));
  const capacity = Math.max(refillRate, Number(bucket?.capacity || refillRate));

  return { refillRate, interval, capacity };
};

const buildArcjetClient = () => {
  if (!config.arcjet.enabled) {
    logger.warn("Arcjet disabled via configuration.");
    return null;
  }

  if (!config.arcjet.key) {
    logger.warn("Arcjet not enabled because ARCJET_KEY is missing.");
    return null;
  }

  const apiBucket = normalizeBucket(config.arcjet.rateLimits.api);
  const authBucket = normalizeBucket(config.arcjet.rateLimits.auth);
  const adminBucket = normalizeBucket(config.arcjet.rateLimits.admin);

  const options = {
    key: config.arcjet.key,
    characteristics: ["ip.src"],
    rules: [
      shield({ mode: config.arcjet.mode }),
      // Search engine bots are allowed while other known bots are denied.
      detectBot({ mode: config.arcjet.mode, allow: ["CATEGORY:SEARCH_ENGINE"] }),
      tokenBucket({
        mode: config.arcjet.mode,
        refillRate: apiBucket.refillRate,
        interval: apiBucket.interval,
        capacity: apiBucket.capacity
      })
    ]
  };

  if (config.arcjet.trustedProxies.length > 0) {
    options.proxies = config.arcjet.trustedProxies;
  }

  const base = arcjet(options);
  const auth = base.withRule([
    tokenBucket({
      mode: config.arcjet.mode,
      refillRate: authBucket.refillRate,
      interval: authBucket.interval,
      capacity: authBucket.capacity
    })
  ]);
  const admin = base.withRule([
    tokenBucket({
      mode: config.arcjet.mode,
      refillRate: adminBucket.refillRate,
      interval: adminBucket.interval,
      capacity: adminBucket.capacity
    })
  ]);

  logger.info("Arcjet protection enabled.", {
    mode: config.arcjet.mode,
    failClosed: config.arcjet.failClosed,
    trustedProxies: config.arcjet.trustedProxies.length,
    apiBucket,
    authBucket,
    adminBucket
  });

  return { base, auth, admin };
};

const clients = buildArcjetClient();

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

      if (decision.isDenied()) {
        return handleDecisionDeny(req, res, decision, scope);
      }

      if (decision.isErrored()) {
        logger.error("Arcjet decision errored", {
          scope,
          path: req.path,
          method: req.method,
          ip: req.ip,
          reason: decision.reason.type
        });

        if (config.arcjet.failClosed) {
          return res.status(503).json({ error: "Security checks unavailable. Please retry." });
        }
      }

      return next();
    } catch (error) {
      logger.error("Arcjet middleware failed", {
        scope,
        path: req.path,
        method: req.method,
        ip: req.ip,
        error: error instanceof Error ? error.message : String(error)
      });

      if (config.arcjet.failClosed) {
        return res.status(503).json({ error: "Security checks unavailable. Please retry." });
      }

      return next();
    }
  };
};

export const arcjetApiProtection = createArcjetMiddleware(clients?.base, "api");
export const arcjetAuthProtection = createArcjetMiddleware(clients?.auth, "auth");
export const arcjetAdminProtection = createArcjetMiddleware(clients?.admin, "admin");
