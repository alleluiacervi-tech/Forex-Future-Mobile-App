import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import prisma from "../db/prisma.js";
import { marketEvents } from "./marketCache.js";
import { symbolToPair } from "./marketSymbols.js";
import { validateTick, isTickOutlier, logDiagnostic } from "./marketValidator.js";

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
  consecutiveMoveCounts: new Map(),
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

const maybeCreateAlerts = async ({ pair, tsMs, price, ticks, priceType }) => {
  const windows = [1, 15, 60, 240, 1440];
  for (const windowMinutes of windows) {
    const threshold = alertThresholds[windowMinutes];
    if (!Number.isFinite(threshold)) continue;

    const windowMs = windowMinutes * 60 * 1000;
    const ref = findPriceAtOrBefore(ticks, tsMs - windowMs, priceType);
    if (!ref || !Number.isFinite(ref.price) || ref.price === 0) {
      logDiagnostic({ pair, tsMs, price, priceType, windowMinutes, note: "no-reference" });
      continue;
    }
    const fromPrice = ref.price;
    const ageDelta = tsMs - ref.tsMs;
    if (ageDelta - windowMs > REF_TICK_TOLERANCE_MS) {
      logDiagnostic({ pair, tsMs, price, priceType, windowMinutes, refTsMs: ref.tsMs, note: "reference-stale" });
      continue;
    }
    const changePercent = ((price - fromPrice) / fromPrice) * 100;
    const abs = Math.abs(changePercent);

    // diagnostic log for each candidate (even if below threshold)
    logDiagnostic({
      pair,
      tsMs,
      price,
      priceType,
      windowMinutes,
      referencePrice: fromPrice,
      referenceTsMs: ref.tsMs,
      tsDelta: tsMs - ref.tsMs,
      changePercent,
      threshold,
      validation: abs >= threshold ? "candidate" : "ignored"
    });

    if (abs < threshold) {
      // reset any consecutive counter – move too small to care
      state.consecutiveMoveCounts.delete(`${pair}|${windowMinutes}|${priceType}`);
      continue;
    }

    // guard against impossibly large moves (institutional sanity check)
    const impossibleCap = MAX_MOVE_CAPS[windowMinutes] || Infinity;
    if (abs > impossibleCap) {
      logDiagnostic({
        pair,
        tsMs,
        price,
        priceType,
        windowMinutes,
        changePercent,
        cap: impossibleCap,
        note: "beyond-impossible"
      });
      // do not treat as alert; require external investigation
      continue;
    }

    // enforce outlier confirmation if move is extremely large relative to threshold
    const extremeMultiplier = Number(process.env.MARKET_ALERT_EXTREME_MULTIPLIER || 5);
    const isExtreme = abs > threshold * extremeMultiplier;
    const confirmKey = `${pair}|${windowMinutes}|${priceType}`;
    if (isExtreme) {
      const prev = state.consecutiveMoveCounts.get(confirmKey) || 0;
      if (prev < 1) {
        // first extreme tick, quarantine it and increment counter
        state.consecutiveMoveCounts.set(confirmKey, prev + 1);
        logDiagnostic({ pair, tsMs, price, priceType, windowMinutes, changePercent, note: "extreme-first" });
        // mark this tick as outlier so it won't be used as a reference
        const lastTick = ticks[ticks.length - 1];
        if (lastTick && lastTick.tsMs === tsMs && lastTick.price === price && lastTick.priceType === priceType) {
          lastTick.outlier = true;
        }
        continue;
      }
      // second consecutive extreme, clear counter and proceed with alert
      state.consecutiveMoveCounts.delete(confirmKey);
    }

    const key = `${pair}|${windowMinutes}|${priceType}`;
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

      void maybeCreateAlerts({ pair, tsMs, price, ticks, priceType });
    } catch (e) {
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

export { startMarketRecorder, alertEvents, getMarketWindowSnapshot, getRecentMarketAlerts };
