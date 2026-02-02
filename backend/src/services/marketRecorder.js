import { EventEmitter } from "events";
import prisma from "../db/prisma.js";
import { marketEvents } from "./marketCache.js";
import { symbolToPair } from "./marketSymbols.js";

const alertEvents = new EventEmitter();

const toBucketStartMs = (timestampMs, interval) => {
  const ts = Number.isFinite(Number(timestampMs)) ? Number(timestampMs) : Date.now();
  if (interval === "1m") return Math.floor(ts / 60000) * 60000;
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
  flushTimer: null,
  flushMs: Number(process.env.MARKET_RECORDER_FLUSH_MS || 5000),
  flushing: false,
  disabledReason: null
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
    return;
  }

  existing.high = Math.max(existing.high, price);
  existing.low = Math.min(existing.low, price);
  existing.close = price;
  existing.volume += v;
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
    const candles = Array.from(state.activeCandles.values());
    for (const candle of candles) {
      await upsertCandle(candle);
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
      const pair = trade?.pair || symbolToPair[trade?.symbol];
      const price = Number(trade?.price);
      if (!pair || !Number.isFinite(price)) return;
      const tsMs = Number.isFinite(Number(trade?.timestampMs)) ? Number(trade.timestampMs) : Date.now();
      const volume = trade?.volume;

      recordIntoCandle({ pair, interval: "1m", tsMs, price, volume });
      recordIntoCandle({ pair, interval: "1d", tsMs, price, volume });
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
