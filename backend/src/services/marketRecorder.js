import { EventEmitter } from "events";
import prisma from "../db/prisma.js";
import Logger from "../utils/logger.js";
import { buildRedisKey, getRedisClient } from "./redis.js";
import { marketEvents } from "./marketCache.js";
import { symbolToPair } from "./marketSymbols.js";
import { validateTick, isTickOutlier, logDiagnostic, pipSizeForPair } from "./marketValidator.js";
import { ForexFutureEngine } from "./forexFutureEngine.js";
import { ForexAlertEngine } from "./forexAlertEngine.js";

const logger = new Logger("MarketRecorder");

// create a single shared engine instance used by the recorder
const forexEngine = new ForexFutureEngine();
// new enterprise-grade alert engine
const forexAlertEngine = new ForexAlertEngine();

// We emit alerts after optional DB persistence in maybeCreateAlerts().
// Keep callback disabled to avoid duplicate marketAlert broadcasts.
forexEngine.onAlert = null;
forexAlertEngine.onAlert = null;

const alertEvents = new EventEmitter();
const recentAlerts = [];
const maxRecentAlerts = Number(process.env.MARKET_ALERT_BUFFER_MAX || 500);
const marketAlertRetentionMs = 24 * 60 * 60 * 1000;
const marketAlertCleanupIntervalMs = Math.max(
  60 * 1000,
  Number(process.env.MARKET_ALERT_CLEANUP_INTERVAL_MS || 15 * 60 * 1000)
);
const redisRecentAlertsKey = buildRedisKey("market", "alerts", "recent");
let warnedMarketAlertCompatFallback = false;

const toTimeMs = (value) => {
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const pruneRecentAlerts = (nowMs = Date.now()) => {
  const cutoffMs = nowMs - marketAlertRetentionMs;
  const retained = recentAlerts.filter((alert) => {
    const tsMs = toTimeMs(alert?.triggeredAt) ?? toTimeMs(alert?.createdAt);
    if (!Number.isFinite(tsMs)) return false;
    return tsMs >= cutoffMs;
  });

  recentAlerts.splice(0, recentAlerts.length, ...retained);
  if (recentAlerts.length > maxRecentAlerts) {
    recentAlerts.splice(maxRecentAlerts, recentAlerts.length - maxRecentAlerts);
  }
};

const pushRecentAlert = (alert) => {
  const nowMs = Date.now();
  const cutoffMs = nowMs - marketAlertRetentionMs;
  const tsMs = toTimeMs(alert?.triggeredAt) ?? toTimeMs(alert?.createdAt) ?? nowMs;

  // Ignore stale alerts outside the retention window.
  if (tsMs < cutoffMs) return;

  pruneRecentAlerts(nowMs);
  recentAlerts.unshift(alert);
  if (recentAlerts.length > maxRecentAlerts) {
    recentAlerts.splice(maxRecentAlerts, recentAlerts.length - maxRecentAlerts);
  }

  const persistRecentAlert = async () => {
    const redis = await getRedisClient();
    if (!redis) return;

    try {
      const serialized = JSON.stringify(alert);
      const pipeline = redis.pipeline();
      pipeline.lpush(redisRecentAlertsKey, serialized);
      pipeline.ltrim(redisRecentAlertsKey, 0, maxRecentAlerts - 1);
      pipeline.expire(redisRecentAlertsKey, Math.ceil(marketAlertRetentionMs / 1000));
      await pipeline.exec();
    } catch (error) {
      logger.warn("Failed to persist recent alert to Redis", { error: error?.message });
    }
  };

  void persistRecentAlert();
};

const getRecentMarketAlerts = async ({ pair = null, limit = 50, since = null } = {}) => {
  pruneRecentAlerts();

  const resolvedLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const retentionFloorMs = Date.now() - marketAlertRetentionMs;
  const requestedSinceMs = since ? toTimeMs(since) : null;
  const sinceMs = Number.isFinite(requestedSinceMs)
    ? Math.max(retentionFloorMs, requestedSinceMs)
    : retentionFloorMs;

  const filterAlerts = (alerts) =>
    alerts
      .filter((alert) => {
        if (pair && alert?.pair !== pair) return false;
        const tsMs = toTimeMs(alert?.triggeredAt) ?? toTimeMs(alert?.createdAt);
        return Number.isFinite(tsMs) ? tsMs >= sinceMs : false;
      })
      .slice(0, resolvedLimit);

  const redis = await getRedisClient();
  if (redis) {
    try {
      const values = await redis.lrange(redisRecentAlertsKey, 0, Math.max(maxRecentAlerts - 1, resolvedLimit - 1));
      if (Array.isArray(values) && values.length > 0) {
        const parsed = values
          .map((entry) => {
            try {
              return JSON.parse(entry);
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        if (parsed.length > 0) {
          return filterAlerts(parsed);
        }
      }
    } catch (error) {
      logger.warn("Failed reading recent alerts from Redis", { error: error?.message });
    }
  }

  return filterAlerts(recentAlerts);
};

const parseIntervalMs = (interval) => {
  if (typeof interval !== "string") return 60 * 1000;
  const match = interval.match(/^(\d+)(min|m|h|d)$/i);
  if (!match) return 60 * 1000;
  const qty = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(qty) || qty <= 0) return 60 * 1000;
  if (unit === "min" || unit === "m") return qty * 60 * 1000;
  if (unit === "h") return qty * 60 * 60 * 1000;
  if (unit === "d") return qty * 24 * 60 * 60 * 1000;
  return 60 * 1000;
};

const toBucketStartMs = (timestampMs, interval) => {
  const ts = Number.isFinite(Number(timestampMs)) ? Number(timestampMs) : Date.now();
  const intervalMs = parseIntervalMs(interval);
  if (interval === "1d") {
    const d = new Date(ts);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
  }
  return Math.floor(ts / intervalMs) * intervalMs;
};

const candleKey = (pair, interval, bucketStartMs) => `${pair}|${interval}|${bucketStartMs}`;
const positiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const state = {
  started: false,
  enabled: process.env.MARKET_RECORDER_ENABLED !== "false",
  activeCandles: new Map(),
  dirtyKeys: new Set(),
  flushTimer: null,
  flushMs: Number(process.env.MARKET_RECORDER_FLUSH_MS || 5000),
  flushBatchSize: positiveInt(process.env.MARKET_RECORDER_FLUSH_BATCH_SIZE, 250),
  flushConcurrency: positiveInt(process.env.MARKET_RECORDER_FLUSH_CONCURRENCY, 8),
  flushing: false,
  disabledReason: null,
  lastDbWarningAt: 0,
  dbRetryAt: 0,
  ticksByPair: new Map(),
  lastAlertKeyAt: new Map(),
  consecutiveMoveCounts: new Map(),
  lastAlertCleanupAt: 0,
  maxTickWindowMs: Number(process.env.MARKET_ALERT_TICK_WINDOW_MS || 26 * 60 * 60 * 1000)
};

const isRetryableDbError = (error) => {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  if (code === "P1001" || code === "P1002" || code === "P1008" || code === "P1017") return true;
  if (/can't reach database server/i.test(message)) return true;
  if (/timed out/i.test(message)) return true;
  if (/connection/i.test(message) && /failed|closed|reset|refused/i.test(message)) return true;
  return false;
};

const isPrismaUnknownArgumentError = (error) => {
  const message = String(error?.message || "");
  return /Unknown argument/i.test(message);
};

const warnDbConnectivity = (error) => {
  const now = Date.now();
  if (now - state.lastDbWarningAt < 30000) return;
  state.lastDbWarningAt = now;
  logger.warn("Database temporarily unavailable. Market recorder will retry.", {
    code: error?.code,
    message: error?.message
  });
};

const ensureTicks = (pair) => {
  const existing = state.ticksByPair.get(pair);
  if (existing) return existing;
  const created = [];
  state.ticksByPair.set(pair, created);
  return created;
};

const pruneTicks = (ticks, nowMs) => {
  const cutoff = nowMs - state.maxTickWindowMs;
  while (ticks.length > 0 && ticks[0].tsMs < cutoff) {
    ticks.shift();
  }
};

// return the most recent tick in the array matching priceType (or null)
const getLastTickOfType = (ticks, priceType) => {
  for (let i = ticks.length - 1; i >= 0; i -= 1) {
    if (ticks[i].priceType === priceType) return ticks[i];
  }
  return null;
};

// look backwards for the most recent tick at or before targetMs that matches the
// requested priceType and is not flagged as an outlier.  Returns the full tick
// object so callers have access to the timestamp for diagnostics.
const findPriceAtOrBefore = (ticks, targetMs, priceType) => {
  for (let i = ticks.length - 1; i >= 0; i -= 1) {
    const t = ticks[i];
    if (t.tsMs <= targetMs) {
      if (priceType && t.priceType !== priceType) continue;
      if (t.outlier) continue;
      return { price: t.price, tsMs: t.tsMs };
    }
  }
  return null;
};



const getMarketWindowSnapshot = (pair, windowsMinutes = [1, 15, 60, 240, 1440]) => {
  const ticks = state.ticksByPair.get(pair) || [];
  const last = ticks.length ? ticks[ticks.length - 1] : null;
  const asOfMs = Number.isFinite(Number(last?.tsMs)) ? Number(last.tsMs) : Date.now();
  const lastPrice = Number.isFinite(Number(last?.price)) ? Number(last.price) : null;
  const lastPriceType = last?.priceType || null;

  const windows = (Array.isArray(windowsMinutes) ? windowsMinutes : [])
    .map((m) => Number(m))
    .filter((m) => Number.isFinite(m) && m > 0)
    .map((windowMinutes) => {
      const windowMs = windowMinutes * 60 * 1000;
      const ref = findPriceAtOrBefore(ticks, asOfMs - windowMs, lastPriceType);
      const fromPrice = ref?.price ?? null;
      const toPrice = lastPrice;
      const changePercent =
        Number.isFinite(fromPrice) && Number.isFinite(toPrice) && fromPrice !== 0
          ? ((toPrice - fromPrice) / fromPrice) * 100
          : null;
      return {
        windowMinutes,
        fromPrice: Number.isFinite(fromPrice) ? fromPrice : null,
        toPrice: Number.isFinite(toPrice) ? toPrice : null,
        changePercent: Number.isFinite(changePercent) ? changePercent : null,
        referenceTsMs: ref?.tsMs ?? null
      };
    });

  return {
    pair,
    asOf: new Date(asOfMs).toISOString(),
    lastPrice,
    windows
  };
};

const cleanupPersistedAlerts = async (nowMs = Date.now()) => {
  if (!prisma.marketAlert) return;
  if (nowMs - state.lastAlertCleanupAt < marketAlertCleanupIntervalMs) return;

  state.lastAlertCleanupAt = nowMs;
  const cutoffDate = new Date(nowMs - marketAlertRetentionMs);
  try {
    await prisma.marketAlert.deleteMany({
      where: {
        triggeredAt: { lt: cutoffDate }
      }
    });
  } catch {}
};

const maybeCreateAlerts = async ({
  pair,
  tsMs,
  price,
  ticks: _ticks,
  priceType: _priceType,
  bid,
  ask,
  volume: _volume
}) => {
  const nowMs = Date.now();
  const retentionFloorMs = nowMs - marketAlertRetentionMs;
  if (!Number.isFinite(Number(tsMs)) || tsMs < retentionFloorMs) {
    // Never emit stale alerts older than the 24h retention window.
    return [];
  }

  pruneRecentAlerts(nowMs);
  await cleanupPersistedAlerts(nowMs);

  // IMPROVED: initialize/reset pair-local engine state the first time this recorder
  // sees a pair (or after explicit state reset in tests/restarts).
  if (!state.lastAlertKeyAt.has(pair)) {
    forexAlertEngine.resetPair(pair);
  }
  state.lastAlertKeyAt.set(pair, tsMs);

  // Use new enterprise-grade alert engine
  let engineAlerts = [];
  try {
    const resolvedBid = Number.isFinite(Number(bid)) ? Number(bid) : Number(price);
    const resolvedAsk = Number.isFinite(Number(ask)) ? Number(ask) : Number(price);
    // IMPROVED: ensure detection still works when upstream omits one side of quote.
    const alert = forexAlertEngine.processTick(pair, resolvedBid, resolvedAsk, tsMs, price);
    if (alert) {
      engineAlerts = [alert];
    }
  } catch (error) {
    logger.error("ForexAlertEngine error", { error: error?.message });
  }

  // persist each alert if DB available and also emit/store in-memory
  for (const alert of engineAlerts) {
    let record = alert;
    if (prisma.marketAlert) {
      try {
        // Map alert object to database schema
        const currentPrice = Number.isFinite(Number(alert.currentBid))
          ? Number(alert.currentBid)
          : Number.isFinite(Number(alert.levels?.entry))
            ? Number(alert.levels.entry)
            : Number(price);
        const pipSize = pipSizeForPair(pair);
        const directionalPips = alert.direction === "SELL" ? -Math.abs(alert.pips) : Math.abs(alert.pips);
        const signedChangePercent =
          Number.isFinite(currentPrice) && currentPrice > 0
            ? (directionalPips * pipSize / currentPrice) * 100
            : null;
        const windowMinutes = Math.max(
          1,
          Math.round((Number.isFinite(Number(alert.timeTakenMs)) ? Number(alert.timeTakenMs) : 0) / 60000)
        );

        const data = {
          pair: alert.pair,
          // IMPROVED: persist an estimated detection window instead of hard-coded 0.
          windowMinutes,
          // IMPROVED: persist move origin/current prices for clearer downstream messaging.
          fromPrice: Number.isFinite(Number(alert.moveOriginPrice))
            ? Number(alert.moveOriginPrice)
            : Number.isFinite(Number(alert.levels?.entry))
              ? Number(alert.levels.entry)
              : Number(price),
          toPrice: currentPrice,
          changePercent: Number.isFinite(signedChangePercent) ? signedChangePercent : 0,
          severity: alert.severity?.name || 'SIGNIFICANT',
          currentPrice,
          direction: alert.direction,
          velocity: {
            speed: alert.speed,
            pips: alert.pips,
            tickFrequency: alert.tickFrequency,
            timeTakenMs: alert.timeTakenMs
          },
          confidence: {
            level: alert.severity?.level,
            name: alert.severity?.name,
            consistency: alert.consistency
          },
          levels: alert.levels,
          triggeredAt: new Date(alert.timestamp)
        };
        try {
          record = await prisma.marketAlert.create({ data });
        } catch (error) {
          // Compatibility path for environments where Prisma Client is older than
          // the deployed schema (or vice-versa). Persist the core alert fields.
          if (!isPrismaUnknownArgumentError(error)) {
            throw error;
          }

          const compatibleData = {
            pair: alert.pair,
            windowMinutes,
            fromPrice: Number.isFinite(Number(data.fromPrice)) ? Number(data.fromPrice) : Number(price),
            toPrice: Number.isFinite(Number(data.toPrice)) ? Number(data.toPrice) : Number(price),
            changePercent: Number.isFinite(Number(data.changePercent)) ? Number(data.changePercent) : 0,
            severity: data.severity,
            triggeredAt: data.triggeredAt
          };

          record = await prisma.marketAlert.create({ data: compatibleData });
          if (!warnedMarketAlertCompatFallback) {
            warnedMarketAlertCompatFallback = true;
            logger.warn(
              "Persisted market alert using compatibility payload (regenerate Prisma client to store full metadata).",
              { pair: alert.pair }
            );
          }
        }
      } catch (e) {
        // ignore persistence errors; keep original alert
        logger.warn("Failed to persist alert", { error: e?.message, pair });
        record = alert;
      }
    }

    try {
      pushRecentAlert(record);
    } catch {}

    try {
      alertEvents.emit("marketAlert", record);
    } catch {}
  }
  // always return engine alerts so caller sees them
  return engineAlerts;
};

const recordIntoCandle = ({ pair, interval, tsMs, price, volume }) => {
  const bucketStartMs = toBucketStartMs(tsMs, interval);
  const key = candleKey(pair, interval, bucketStartMs);
  const existing = state.activeCandles.get(key);
  const v = Number.isFinite(Number(volume)) ? Number(volume) : 0;

  if (!existing) {
    state.activeCandles.set(key, {
      pair,
      interval,
      bucketStartMs,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: v
    });
    state.dirtyKeys.add(key);
    return;
  }

  existing.high = Math.max(existing.high, price);
  existing.low = Math.min(existing.low, price);
  existing.close = price;
  existing.volume += v;
  state.dirtyKeys.add(key);
};

const upsertCandle = async (candle) => {
  const bucketStart = new Date(candle.bucketStartMs);
  await prisma.marketCandle.upsert({
    where: {
      pair_interval_bucketStart: {
        pair: candle.pair,
        interval: candle.interval,
        bucketStart
      }
    },
    create: {
      pair: candle.pair,
      interval: candle.interval,
      bucketStart,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume
    },
    update: {
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume
    }
  });
};

// IMPROVED: prevent unbounded growth of active candle map in long-running sessions.
const pruneActiveCandles = (nowMs = Date.now()) => {
  state.activeCandles.forEach((candle, key) => {
    if (state.dirtyKeys.has(key)) return;
    const intervalMs = parseIntervalMs(candle.interval);
    const ttlMs = Math.max(intervalMs * 3, 10 * 60 * 1000);
    if (nowMs - candle.bucketStartMs > ttlMs) {
      state.activeCandles.delete(key);
    }
  });
};

const flush = async () => {
  if (!state.enabled || state.flushing) return;
  if (state.dbRetryAt && Date.now() < state.dbRetryAt) return;
  if (!prisma.marketCandle) {
    state.enabled = false;
    state.disabledReason = "Prisma client missing MarketCandle model (run prisma migrate/generate).";
    return;
  }

  state.flushing = true;
  try {
    const keys = Array.from(state.dirtyKeys.values());
    const batchKeys = keys.slice(0, state.flushBatchSize);
    let stopFlush = false;

    for (let i = 0; i < batchKeys.length && !stopFlush; i += state.flushConcurrency) {
      const chunk = batchKeys.slice(i, i + state.flushConcurrency);
      const chunkPromises = chunk.map(async (key) => {
        const candle = state.activeCandles.get(key);
        if (!candle) return;
        await upsertCandle(candle);
      });
      const settled = await Promise.allSettled(chunkPromises);

      for (let idx = 0; idx < settled.length; idx += 1) {
        const result = settled[idx];
        const key = chunk[idx];

        if (result.status === "fulfilled") {
          state.dirtyKeys.delete(key);
          continue;
        }

        const error = result.reason;
        if (isRetryableDbError(error)) {
          state.disabledReason = error?.message || "database temporarily unavailable";
          state.dbRetryAt = Date.now() + 30000;
          warnDbConnectivity(error);
          stopFlush = true;
          break;
        }

        state.enabled = false;
        state.disabledReason = error?.message || "market recorder flush failed";
        state.dbRetryAt = 0;
        stopFlush = true;
        break;
      }
    }

    if (!state.dirtyKeys.size) {
      state.dbRetryAt = 0;
    }
  } finally {
    state.flushing = false;
    pruneActiveCandles();
  }
};

const startMarketRecorder = () => {
  if (state.started) {
    return { started: true, enabled: state.enabled, disabledReason: state.disabledReason };
  }
  state.started = true;
  pruneRecentAlerts();
  void cleanupPersistedAlerts();

  const onTrade = (trade) => {
    try {
      if (!state.enabled) return;
      const pair = trade?.pair || symbolToPair[trade?.symbol];
      const price = Number(trade?.price);
      if (!pair || !Number.isFinite(price)) return;
      const tsMs = Number.isFinite(Number(trade?.timestampMs)) ? Number(trade.timestampMs) : Date.now();
      const volume = trade?.volume;
      const priceType = trade?.priceType || "last";

      const ticks = ensureTicks(pair);
      // reject ticks that arrive with a timestamp earlier than the most recent
      // tick of the same priceType – feeding stale data would corrupt windows.
      const lastSame = getLastTickOfType(ticks, priceType);
      if (lastSame && tsMs < lastSame.tsMs) {
        logDiagnostic({ pair, tsMs, price, priceType, validation: "out-of-order" });
        return;
      }

      const tick = { tsMs, price, priceType };

      const validation = validateTick({ pair, tsMs, price, priceType });
      if (!validation.ok) {
        logDiagnostic({ pair, tsMs, price, priceType, validation: validation.issues.join(';') });
        // do not push invalid tick or create alerts
        return;
      }

      tick.outlier = isTickOutlier(ticks, tick);
      if (tick.outlier) {
        logDiagnostic({ pair, tsMs, price, priceType, note: "outlier" });
      }

      ticks.push(tick);
      pruneTicks(ticks, tsMs);

      // update candles using the nominal price even if flagged outlier; candles are
      // forgiving but alerts will ignore outliers later via findPriceAtOrBefore
      recordIntoCandle({ pair, interval: "1m", tsMs, price, volume });
      recordIntoCandle({ pair, interval: "15m", tsMs, price, volume });
      recordIntoCandle({ pair, interval: "1h", tsMs, price, volume });
      recordIntoCandle({ pair, interval: "4h", tsMs, price, volume });
      recordIntoCandle({ pair, interval: "1d", tsMs, price, volume });

      // IMPROVED: outliers are retained for diagnostics/candles but excluded from alert detection.
      if (tick.outlier) return;

      void maybeCreateAlerts({ pair, tsMs, price, ticks, priceType, bid: trade.bid, ask: trade.ask, volume });
    } catch (_e) {
      // swallow to ensure recorder cannot crash the process
    }
  };

  marketEvents.on("trade", onTrade);
  state.flushTimer = setInterval(() => {
    flush();
  }, state.flushMs);

  return {
    started: true,
    enabled: state.enabled,
    disabledReason: state.disabledReason,
    stop: () => {
      try {
        marketEvents.off("trade", onTrade);
      } catch {}
      try {
        if (state.flushTimer) clearInterval(state.flushTimer);
      } catch {}
      state.flushTimer = null;
      flush();
    }
  };
};

export {
  startMarketRecorder,
  alertEvents,
  getMarketWindowSnapshot,
  getRecentMarketAlerts,
  maybeCreateAlerts,
  marketAlertRetentionMs,
  state,
  // engines for direct access
  forexEngine,
  forexAlertEngine
};
