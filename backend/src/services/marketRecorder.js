import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import prisma from "../db/prisma.js";
import { marketEvents } from "./marketCache.js";
import { symbolToPair } from "./marketSymbols.js";

const alertEvents = new EventEmitter();
const recentAlerts = [];
const maxRecentAlerts = Number(process.env.MARKET_ALERT_BUFFER_MAX || 500);

const toTimeMs = (value) => {
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const pushRecentAlert = (alert) => {
  recentAlerts.unshift(alert);
  if (recentAlerts.length > maxRecentAlerts) {
    recentAlerts.splice(maxRecentAlerts, recentAlerts.length - maxRecentAlerts);
  }
};

const getRecentMarketAlerts = ({ pair = null, limit = 50, since = null } = {}) => {
  const resolvedLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const sinceMs = since ? toTimeMs(since) : null;

  const filtered = recentAlerts.filter((alert) => {
    if (pair && alert?.pair !== pair) return false;
    if (!sinceMs) return true;
    const tsMs = toTimeMs(alert?.triggeredAt) ?? toTimeMs(alert?.createdAt);
    return Number.isFinite(tsMs) ? tsMs >= sinceMs : true;
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

const findPriceAtOrBefore = (ticks, targetMs) => {
  for (let i = ticks.length - 1; i >= 0; i -= 1) {
    if (ticks[i].tsMs <= targetMs) return ticks[i].price;
  }
  return null;
};

const getMarketWindowSnapshot = (pair, windowsMinutes = [1, 15, 60, 240, 1440]) => {
  const ticks = state.ticksByPair.get(pair) || [];
  const last = ticks.length ? ticks[ticks.length - 1] : null;
  const asOfMs = Number.isFinite(Number(last?.tsMs)) ? Number(last.tsMs) : Date.now();
  const lastPrice = Number.isFinite(Number(last?.price)) ? Number(last.price) : null;

  const windows = (Array.isArray(windowsMinutes) ? windowsMinutes : [])
    .map((m) => Number(m))
    .filter((m) => Number.isFinite(m) && m > 0)
    .map((windowMinutes) => {
      const windowMs = windowMinutes * 60 * 1000;
      const fromPrice = findPriceAtOrBefore(ticks, asOfMs - windowMs);
      const toPrice = lastPrice;
      const changePercent =
        Number.isFinite(fromPrice) && Number.isFinite(toPrice) && fromPrice !== 0
          ? ((toPrice - fromPrice) / fromPrice) * 100
          : null;
      return {
        windowMinutes,
        fromPrice: Number.isFinite(fromPrice) ? fromPrice : null,
        toPrice: Number.isFinite(toPrice) ? toPrice : null,
        changePercent: Number.isFinite(changePercent) ? changePercent : null
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

const severityFor = (absChangePercent, windowMinutes) => {
  if (windowMinutes >= 240 && absChangePercent >= 1.2) return "high";
  if (windowMinutes >= 60 && absChangePercent >= 0.9) return "high";
  if (windowMinutes >= 15 && absChangePercent >= 0.5) return "high";
  if (absChangePercent >= 0.6) return "high";
  return "medium";
};

const maybeCreateAlerts = async ({ pair, tsMs, price, ticks }) => {
  const windows = [1, 15, 60, 240, 1440];
  for (const windowMinutes of windows) {
    const threshold = alertThresholds[windowMinutes];
    if (!Number.isFinite(threshold)) continue;

    const windowMs = windowMinutes * 60 * 1000;
    const fromPrice = findPriceAtOrBefore(ticks, tsMs - windowMs);
    if (!Number.isFinite(fromPrice) || fromPrice === 0) continue;

    const changePercent = ((price - fromPrice) / fromPrice) * 100;
    const abs = Math.abs(changePercent);
    if (abs < threshold) continue;

    const key = `${pair}|${windowMinutes}`;
    const lastAt = state.lastAlertKeyAt.get(key) || 0;
    if (tsMs - lastAt < alertCooldownMs) continue;
    state.lastAlertKeyAt.set(key, tsMs);

    const severity = severityFor(abs, windowMinutes);

    const memoryAlert = {
      id: uuidv4(),
      pair,
      windowMinutes,
      fromPrice,
      toPrice: price,
      changePercent,
      severity,
      triggeredAt: new Date(tsMs),
      createdAt: new Date(tsMs)
    };

    let emitted = memoryAlert;
    if (prisma.marketAlert) {
      try {
        emitted = await prisma.marketAlert.create({
          data: {
            pair,
            windowMinutes,
            fromPrice,
            toPrice: price,
            changePercent,
            severity,
            triggeredAt: new Date(tsMs)
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
  }
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

  const onTrade = (trade) => {
    try {
      if (!state.enabled) return;
      const pair = trade?.pair || symbolToPair[trade?.symbol];
      const price = Number(trade?.price);
      if (!pair || !Number.isFinite(price)) return;
      const tsMs = Number.isFinite(Number(trade?.timestampMs)) ? Number(trade.timestampMs) : Date.now();
      const volume = trade?.volume;

      const ticks = ensureTicks(pair);
      ticks.push({ tsMs, price });
      pruneTicks(ticks, tsMs);

      recordIntoCandle({ pair, interval: "1m", tsMs, price, volume });
      recordIntoCandle({ pair, interval: "15m", tsMs, price, volume });
      recordIntoCandle({ pair, interval: "1h", tsMs, price, volume });
      recordIntoCandle({ pair, interval: "4h", tsMs, price, volume });
      recordIntoCandle({ pair, interval: "1d", tsMs, price, volume });

      void maybeCreateAlerts({ pair, tsMs, price, ticks });
    } catch {}
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

export { startMarketRecorder, alertEvents, getMarketWindowSnapshot, getRecentMarketAlerts };
