import { EventEmitter } from "events";
import Logger from "../utils/logger.js";
import { buildRedisKey, getRedisClient } from "./redis.js";
import { basePrices, pairToSymbol, supportedPairs, symbolToPair } from "./marketSymbols.js";

const logger = new Logger("MarketCache");

const liveBySymbol = new Map();
const historyBySymbol = new Map();
const MAX_HISTORY_POINTS = 2000;

const LIVE_TTL_SECONDS = Math.max(60, Number(process.env.MARKET_CACHE_LIVE_TTL_SECONDS || 3600));
const HISTORY_TTL_SECONDS = Math.max(300, Number(process.env.MARKET_CACHE_HISTORY_TTL_SECONDS || 24 * 60 * 60));

const marketEvents = new EventEmitter();
const logCacheWrites =
  process.env.MARKET_CACHE_DEBUG === "true" || process.env.MARKET_DEBUG_LOGS === "true";

const isJpyPair = (pair) => pair.includes("JPY");
const decimalsForPair = (pair) => (isJpyPair(pair) ? 3 : 5);
const pipSizeForPair = (pair) => (isJpyPair(pair) ? 0.01 : 0.0001);
const roundTo = (value, decimals) => Number(Number(value).toFixed(decimals));

const parseIntervalMs = (interval) => {
  if (typeof interval !== "string") return 60 * 60 * 1000;
  const match = interval.match(/^(\d+)(min|m|h|d|w)$/i);
  if (!match) return 60 * 60 * 1000;
  const qty = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(qty) || qty <= 0) return 60 * 60 * 1000;
  if (unit === "min" || unit === "m") return qty * 60 * 1000;
  if (unit === "h") return qty * 60 * 60 * 1000;
  if (unit === "d") return qty * 24 * 60 * 60 * 1000;
  if (unit === "w") return qty * 7 * 24 * 60 * 60 * 1000;
  return 60 * 60 * 1000;
};

const getLiveKey = (symbol) => buildRedisKey("market", "live", symbol);
const getHistoryKey = (symbol) => buildRedisKey("market", "history", symbol);

const runRedisWrite = (operationName, callback) => {
  const run = async () => {
    const redis = await getRedisClient();
    if (!redis) return;

    try {
      await callback(redis);
    } catch (error) {
      logger.warn("Redis write failed", { operation: operationName, error: error?.message });
    }
  };

  void run();
};

const parseRedisPayload = (rawValue) => {
  if (!rawValue) return null;
  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
};

const recordTrade = ({ symbol, price, timestampMs, volume, priceType = "last", bid = null, ask = null }) => {
  if (!symbolToPair[symbol]) return;
  if (!Number.isFinite(price) || price <= 0) return;
  const ts = Number.isFinite(timestampMs) ? timestampMs : Date.now();

  if (logCacheWrites) {
    const previous = liveBySymbol.get(symbol);
    logger.debug("Recorded trade tick", {
      symbol,
      price,
      previousPrice: previous?.price,
      timestamp: new Date(ts).toISOString(),
      priceType
    });
  }

  const livePayload = {
    symbol,
    price,
    timestampMs: ts,
    priceType,
    volume: Number.isFinite(Number(volume)) ? Number(volume) : 0,
    bid: Number.isFinite(Number(bid)) ? Number(bid) : null,
    ask: Number.isFinite(Number(ask)) ? Number(ask) : null
  };

  liveBySymbol.set(symbol, livePayload);

  try {
    const pair = symbolToPair[symbol];
    marketEvents.emit("trade", {
      ...livePayload,
      pair
    });
  } catch {}

  const history = historyBySymbol.get(symbol) || [];
  history.push({ price, timestampMs: ts });
  if (history.length > MAX_HISTORY_POINTS) {
    history.splice(0, history.length - MAX_HISTORY_POINTS);
  }
  historyBySymbol.set(symbol, history);

  runRedisWrite("recordTrade", async (redis) => {
    const historyPayload = JSON.stringify({ price, timestampMs: ts });
    const liveJson = JSON.stringify(livePayload);
    const historyKey = getHistoryKey(symbol);

    const pipeline = redis.pipeline();
    pipeline.set(getLiveKey(symbol), liveJson, "EX", LIVE_TTL_SECONDS);
    pipeline.rpush(historyKey, historyPayload);
    pipeline.ltrim(historyKey, -MAX_HISTORY_POINTS, -1);
    pipeline.expire(historyKey, HISTORY_TTL_SECONDS);
    await pipeline.exec();
  });
};

const recordQuote = ({ symbol, bid, ask, timestampMs }) => {
  if (!symbolToPair[symbol]) return;
  const b = Number(bid);
  const a = Number(ask);
  if (!Number.isFinite(b) || !Number.isFinite(a)) return;
  const mid = (b + a) / 2;

  if (logCacheWrites) {
    logger.debug("Recorded quote tick", {
      symbol,
      bid: b,
      ask: a,
      mid,
      timestamp: new Date(timestampMs ?? Date.now()).toISOString()
    });
  }

  recordTrade({ symbol, price: mid, timestampMs, priceType: "mid", bid: b, ask: a });
};

const buildRateFromTick = ({ pair, price, timestampMs, bid, ask, volume }) => {
  const pip = pipSizeForPair(pair);
  const spread = pip * 1.5;
  const decimals = decimalsForPair(pair);

  const resolvedBid = Number.isFinite(Number(bid)) ? Number(bid) : roundTo(price - spread / 2, decimals);
  const resolvedAsk = Number.isFinite(Number(ask)) ? Number(ask) : roundTo(price + spread / 2, decimals);

  return {
    pair,
    bid: roundTo(resolvedBid, decimals),
    ask: roundTo(resolvedAsk, decimals),
    mid: roundTo(price, decimals),
    spread: roundTo(resolvedAsk - resolvedBid, decimals),
    volume: Number.isFinite(Number(volume)) ? Number(volume) : 0,
    timestamp: new Date(timestampMs).toISOString()
  };
};

const filterLiveEntryByAge = (entry, now, enforceMaxAge, maxAgeMs) => {
  if (!entry) return false;
  if (!enforceMaxAge) return true;
  return now - Number(entry.timestampMs || 0) <= Number(maxAgeMs);
};

const getLiveFromRedis = async () => {
  const redis = await getRedisClient();
  if (!redis) return null;

  try {
    const keys = Object.keys(symbolToPair).map((symbol) => getLiveKey(symbol));
    const rawEntries = await redis.mget(keys);
    const bySymbol = new Map();

    rawEntries.forEach((raw, index) => {
      const parsed = parseRedisPayload(raw);
      if (!parsed) return;
      const symbol = Object.keys(symbolToPair)[index];
      bySymbol.set(symbol, parsed);
    });

    return bySymbol;
  } catch (error) {
    logger.warn("Redis live cache read failed", { error: error?.message });
    return null;
  }
};

const getLiveRatesFromCache = async ({ includeFallbackBasePrices = false, maxAgeMs = null } = {}) => {
  const now = Date.now();
  const enforceMaxAge =
    maxAgeMs !== null &&
    maxAgeMs !== undefined &&
    Number.isFinite(Number(maxAgeMs)) &&
    Number(maxAgeMs) >= 0;

  const redisLive = await getLiveFromRedis();
  const sourceMap = redisLive && redisLive.size > 0 ? redisLive : liveBySymbol;

  return supportedPairs
    .map((pair) => {
      const symbol = pairToSymbol[pair];
      const latest = symbol ? sourceMap.get(symbol) : null;

      if (latest && !filterLiveEntryByAge(latest, now, enforceMaxAge, maxAgeMs)) {
        return null;
      }

      if (!latest && !includeFallbackBasePrices) {
        return null;
      }

      const price = latest?.price ?? basePrices[pair];
      const ts = latest?.timestampMs ?? now;
      return buildRateFromTick({
        pair,
        price,
        timestampMs: ts,
        bid: latest?.bid,
        ask: latest?.ask,
        volume: latest?.volume
      });
    })
    .filter(Boolean);
};

const clearLiveRatesCache = () => {
  liveBySymbol.clear();

  runRedisWrite("clearLiveRatesCache", async (redis) => {
    const keys = Object.keys(symbolToPair).map((symbol) => getLiveKey(symbol));
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });
};

const getHistoricalFromRedis = async (symbol, points) => {
  const redis = await getRedisClient();
  if (!redis) return null;

  try {
    const values = await redis.lrange(getHistoryKey(symbol), -points, -1);
    if (!Array.isArray(values) || values.length === 0) return [];
    return values
      .map(parseRedisPayload)
      .filter(Boolean)
      .map((entry) => ({
        price: Number(entry.price),
        timestampMs: Number(entry.timestampMs)
      }))
      .filter((entry) => Number.isFinite(entry.price) && Number.isFinite(entry.timestampMs));
  } catch (error) {
    logger.warn("Redis history cache read failed", { symbol, error: error?.message });
    return null;
  }
};

const getHistoricalFromCache = async ({ pair, points, interval }) => {
  const symbol = pairToSymbol[pair];
  if (!symbol) {
    throw new Error(`Unsupported pair: ${pair}`);
  }

  const intervalMs = parseIntervalMs(interval);
  const now = Date.now();
  const fallbackPrice = basePrices[pair];

  const redisHistory = await getHistoricalFromRedis(symbol, points);
  const memoryHistory = historyBySymbol.get(symbol) || [];
  const history = Array.isArray(redisHistory) ? redisHistory : memoryHistory;

  const data = [];
  for (let i = points - 1; i >= 0; i -= 1) {
    const ts = now - i * intervalMs;
    const entry = history[history.length - points + (points - 1 - i)];
    const price = entry?.price ?? fallbackPrice;
    const open = price;
    const close = price;
    const high = price;
    const low = price;
    data.push({
      timestamp: new Date(ts).toISOString(),
      value: close,
      open,
      high,
      low,
      close,
      volatility: 0,
      volume: 0
    });
  }

  return data;
};

export {
  marketEvents,
  recordTrade,
  recordQuote,
  getLiveRatesFromCache,
  clearLiveRatesCache,
  getHistoricalFromCache
};
