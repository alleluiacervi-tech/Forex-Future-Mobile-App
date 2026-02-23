import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import prisma from "../db/prisma.js";
import { marketEvents } from "./marketCache.js";
import { symbolToPair } from "./marketSymbols.js";
import { validateTick, isTickOutlier, logDiagnostic } from "./marketValidator.js";
import { ForexFutureEngine } from "./forexFutureEngine.js";

// create a single shared engine instance used by the recorder
const forexEngine = new ForexFutureEngine();
// hook the engine into our existing alert event infrastructure so that
// any alert produced internally is treated exactly the same as the old
// maybeCreateAlerts alerts.
forexEngine.onAlert = (alert) => {
  try { pushRecentAlert(alert); } catch {}
  try { alertEvents.emit("marketAlert", alert); } catch {}
};

const alertEvents = new EventEmitter();
const recentAlerts = [];
const maxRecentAlerts = Number(process.env.MARKET_ALERT_BUFFER_MAX || 500);
const marketAlertRetentionMs = 24 * 60 * 60 * 1000;
const marketAlertCleanupIntervalMs = Math.max(
  60 * 1000,
  Number(process.env.MARKET_ALERT_CLEANUP_INTERVAL_MS || 15 * 60 * 1000)
);

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
};

const getRecentMarketAlerts = ({ pair = null, limit = 50, since = null } = {}) => {
  pruneRecentAlerts();

  const resolvedLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const retentionFloorMs = Date.now() - marketAlertRetentionMs;
  const requestedSinceMs = since ? toTimeMs(since) : null;
  const sinceMs = Number.isFinite(requestedSinceMs)
    ? Math.max(retentionFloorMs, requestedSinceMs)
    : retentionFloorMs;

  const filtered = recentAlerts.filter((alert) => {
    if (pair && alert?.pair !== pair) return false;
    const tsMs = toTimeMs(alert?.triggeredAt) ?? toTimeMs(alert?.createdAt);
    return Number.isFinite(tsMs) ? tsMs >= sinceMs : false;
  });

  return filtered.slice(0, resolvedLimit);
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

const state = {
  started: false,
  enabled: process.env.MARKET_RECORDER_ENABLED !== "false",
  activeCandles: new Map(),
  dirtyKeys: new Set(),
  flushTimer: null,
  flushMs: Number(process.env.MARKET_RECORDER_FLUSH_MS || 5000),
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

const warnDbConnectivity = (error) => {
  const now = Date.now();
  if (now - state.lastDbWarningAt < 30000) return;
  state.lastDbWarningAt = now;
  try {
    console.warn(
      "[MarketRecorder] Database temporarily unavailable. Will retry on next flush.",
      {
        code: error?.code,
        message: error?.message
      }
    );
  } catch {}
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

const alertThresholds = {
  1: Number(process.env.MARKET_ALERT_THRESHOLD_1M || 0.12),
  15: Number(process.env.MARKET_ALERT_THRESHOLD_15M || 0.45),
  60: Number(process.env.MARKET_ALERT_THRESHOLD_1H || 0.9),
  240: Number(process.env.MARKET_ALERT_THRESHOLD_4H || 1.4),
  1440: Number(process.env.MARKET_ALERT_THRESHOLD_1D || 2.2)
};

const alertCooldownMs = Number(process.env.MARKET_ALERT_COOLDOWN_MS || 10 * 60 * 1000);
// tolerance for how old the reference tick may be relative to the ideal window
// start; if the chosen tick precedes (windowMs + tolerance) we consider the
// price stale and skip the comparison.
const REF_TICK_TOLERANCE_MS = Number(process.env.MARKET_ALERT_REF_TOLERANCE_MS || 5000);

// optional hard cap on what constitutes a physically impossible move over a
// given window.  Used as additional sanity-check in maybeCreateAlerts.
const MAX_MOVE_CAPS = {
  1: Number(process.env.MARKET_ALERT_MAX_MOVE_CAP_1M || 5),
  15: Number(process.env.MARKET_ALERT_MAX_MOVE_CAP_15M || 10),
  60: Number(process.env.MARKET_ALERT_MAX_MOVE_CAP_1H || 20),
  240: Number(process.env.MARKET_ALERT_MAX_MOVE_CAP_4H || 40),
  1440: Number(process.env.MARKET_ALERT_MAX_MOVE_CAP_1D || 100)
};

const severityFor = (absChangePercent, windowMinutes) => {
  if (windowMinutes >= 240 && absChangePercent >= 1.2) return "high";
  if (windowMinutes >= 60 && absChangePercent >= 0.9) return "high";
  if (windowMinutes >= 15 && absChangePercent >= 0.5) return "high";
  if (absChangePercent >= 0.6) return "high";
  return "medium";
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

const maybeCreateAlerts = async ({ pair, tsMs, price, ticks, priceType, bid, ask, volume }) => {
  const nowMs = Date.now();
  const retentionFloorMs = nowMs - marketAlertRetentionMs;
  if (!Number.isFinite(Number(tsMs)) || tsMs < retentionFloorMs) {
    // Never emit stale alerts older than the 24h retention window.
    return [];
  }

  pruneRecentAlerts(nowMs);
  await cleanupPersistedAlerts(nowMs);

  // hand off to the new high-performance engine
  const engineAlerts = forexEngine.processTick(pair, price, priceType, tsMs, { bid, ask, volume });
  const createdAlerts = [];
  for (const alert of engineAlerts) {
    let emitted = alert;
    if (prisma.marketAlert) {
      try {
        emitted = await prisma.marketAlert.create({
          data: {
            pair: alert.pair,
            windowMinutes: null,
            fromPrice: null,
            toPrice: alert.currentPrice,
            changePercent: null,
            severity: null,
            triggeredAt: new Date(alert.timestamp)
          }
        });
      } catch {}
    }

    try {
      pushRecentAlert(emitted);
    } catch {}

    try {
      alertEvents.emit("marketAlert", emitted);
    } catch {}
    createdAlerts.push(emitted);
  }
  return createdAlerts;
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
    for (const key of keys) {
      const candle = state.activeCandles.get(key);
      if (!candle) {
        state.dirtyKeys.delete(key);
        continue;
      }

      try {
        await upsertCandle(candle);
        state.dirtyKeys.delete(key);
      } catch (error) {
        if (isRetryableDbError(error)) {
          state.disabledReason = error?.message || "database temporarily unavailable";
          state.dbRetryAt = Date.now() + 30000;
          warnDbConnectivity(error);
          break;
        }

        state.enabled = false;
        state.disabledReason = error?.message || "market recorder flush failed";
        state.dbRetryAt = 0;
        break;
      }
    }
    if (!state.dirtyKeys.size) {
      state.dbRetryAt = 0;
    }
  } finally {
    state.flushing = false;
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
  state
};
