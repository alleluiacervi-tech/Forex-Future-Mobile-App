import { EventEmitter } from "events";
import prisma from "../db/prisma.js";
import { marketEvents } from "./marketCache.js";
import { symbolToPair } from "./marketSymbols.js";

const alertEvents = new EventEmitter();

const toBucketStartMs = (timestampMs, interval) => {
  const ts = Number.isFinite(Number(timestampMs)) ? Number(timestampMs) : Date.now();
  if (interval === "1m") return Math.floor(ts / 60000) * 60000;
  if (interval === "1h") return Math.floor(ts / 3600000) * 3600000;
  if (interval === "1d") {
    const d = new Date(ts);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
  }
  return Math.floor(ts / 60000) * 60000;
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
  ticksByPair: new Map(),
  lastAlertKeyAt: new Map(),
  maxTickWindowMs: Number(process.env.MARKET_ALERT_TICK_WINDOW_MS || 30 * 60 * 1000)
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

const alertThresholds = {
  1: Number(process.env.MARKET_ALERT_THRESHOLD_1M || 0.12),
  5: Number(process.env.MARKET_ALERT_THRESHOLD_5M || 0.25),
  15: Number(process.env.MARKET_ALERT_THRESHOLD_15M || 0.45)
};

const alertCooldownMs = Number(process.env.MARKET_ALERT_COOLDOWN_MS || 10 * 60 * 1000);

const severityFor = (absChangePercent, windowMinutes) => {
  if (windowMinutes >= 15 && absChangePercent >= 0.5) return "high";
  if (windowMinutes >= 5 && absChangePercent >= 0.35) return "high";
  if (absChangePercent >= 0.6) return "high";
  return "medium";
};

const maybeCreateAlerts = async ({ pair, tsMs, price, ticks }) => {
  if (!prisma.marketAlert) return;

  const windows = [1, 5, 15];
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

    try {
      const created = await prisma.marketAlert.create({
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

      try {
        alertEvents.emit("marketAlert", created);
      } catch {}
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
  if (!prisma.marketCandle) {
    state.enabled = false;
    state.disabledReason = "Prisma client missing MarketCandle model (run prisma migrate/generate).";
    return;
  }

  state.flushing = true;
  try {
    const keys = Array.from(state.dirtyKeys.values());
    state.dirtyKeys.clear();
    for (const key of keys) {
      const candle = state.activeCandles.get(key);
      if (candle) await upsertCandle(candle);
    }
  } catch (error) {
    state.enabled = false;
    state.disabledReason = error?.message || "market recorder flush failed";
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
      recordIntoCandle({ pair, interval: "1h", tsMs, price, volume });
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

export { startMarketRecorder, alertEvents };
