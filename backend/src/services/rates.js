import config from "../config.js";

const basePrices = {
  "EUR/USD": 1.0842,
  "GBP/USD": 1.2719,
  "USD/JPY": 148.22,
  "AUD/USD": 0.6614,
  "USD/CAD": 1.3517,
  "USD/CHF": 0.8732,
  "NZD/USD": 0.6111,
  "EUR/GBP": 0.8526
};

const supportedPairs = Object.keys(basePrices);

const TWELVE_BASE_URL = "https://api.twelvedata.com";
const LIVE_CACHE_TTL_MS = 8000;
const HISTORY_CACHE_TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 8000;

const isJpyPair = (pair) => pair.includes("JPY");
const decimalsForPair = (pair) => (isJpyPair(pair) ? 3 : 5);
const pipSizeForPair = (pair) => (isJpyPair(pair) ? 0.01 : 0.0001);
const roundTo = (value, decimals) => Number(Number(value).toFixed(decimals));

const toNumberOrNull = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const liveCache = {
  timestamp: 0,
  data: null
};

const historyCache = new Map();

const fetchJson = async (path, params) => {
  if (!config.twelveDataApiKey) {
    throw new Error("Missing TWELVEDATA_API_KEY configuration.");
  }

  const url = new URL(`${TWELVE_BASE_URL}${path}`);
  const searchParams = new URLSearchParams(params);
  searchParams.set("apikey", config.twelveDataApiKey);
  url.search = searchParams.toString();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Twelve Data error (${response.status}): ${body}`);
    }
    const payload = await response.json();
    if (payload?.status === "error") {
      throw new Error(payload.message || "Twelve Data error.");
    }
    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
};

const normalizeBatchResponse = (payload, symbols) => {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  if (payload.status === "error") {
    throw new Error(payload.message || "Twelve Data error.");
  }

  if (payload.values) {
    const symbol = payload?.meta?.symbol || symbols[0];
    return { [symbol]: payload };
  }

  const container = payload.data && typeof payload.data === "object" ? payload.data : payload;
  const result = {};

  symbols.forEach((symbol) => {
    const entry = container?.[symbol];
    if (!entry) return;
    if (entry.status === "error") return;
    if (entry.values) {
      result[symbol] = entry;
    }
  });

  return result;
};

const fetchTimeSeries = async ({ symbols, interval, outputsize }) => {
  const payload = await fetchJson("/time_series", {
    symbol: symbols.join(","),
    interval,
    outputsize: String(outputsize),
    order: "DESC"
  });

  return normalizeBatchResponse(payload, symbols);
};

const getLiveRates = async () => {
  const now = Date.now();
  if (liveCache.data && now - liveCache.timestamp < LIVE_CACHE_TTL_MS) {
    return liveCache.data;
  }

  try {
    const seriesMap = await fetchTimeSeries({
      symbols: supportedPairs,
      interval: "1min",
      outputsize: 1
    });

    const timestamp = new Date().toISOString();
    const rates = supportedPairs
      .map((pair) => {
        const series = seriesMap[pair];
        const latest = series?.values?.[0];
        const mid = toNumberOrNull(latest?.close ?? latest?.open);
        if (!latest || mid === null) return null;

        const pip = pipSizeForPair(pair);
        const spread = pip * 1.5;
        const decimals = decimalsForPair(pair);
        const bid = roundTo(mid - spread / 2, decimals);
        const ask = roundTo(mid + spread / 2, decimals);

        return {
          pair,
          bid,
          ask,
          mid: roundTo(mid, decimals),
          spread: roundTo(ask - bid, decimals),
          volume: toNumberOrNull(latest?.volume) ?? 0,
          timestamp: latest?.datetime ? new Date(latest.datetime).toISOString() : timestamp
        };
      })
      .filter(Boolean);

    if (rates.length === 0 && liveCache.data) {
      return liveCache.data;
    }

    liveCache.timestamp = now;
    liveCache.data = rates;
    return rates;
  } catch (error) {
    if (liveCache.data) {
      return liveCache.data;
    }
    throw error;
  }
};

const getHistoricalRates = async (pair, points = 60, opts = {}) => {
  const { interval = "1h" } = opts;
  const cacheKey = `${pair}:${points}:${interval}`;
  const cached = historyCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < HISTORY_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const seriesMap = await fetchTimeSeries({
      symbols: [pair],
      interval,
      outputsize: points
    });

    const series = seriesMap[pair];
    const values = Array.isArray(series?.values) ? series.values : [];
    const ordered = values.slice().reverse();

    const data = ordered
      .map((item) => {
        const close = toNumberOrNull(item?.close);
        const high = toNumberOrNull(item?.high);
        const low = toNumberOrNull(item?.low);
        if (close === null || high === null || low === null) return null;

        const volatility = close !== 0 ? Math.abs(high - low) / close : 0;
        return {
          timestamp: item?.datetime ? new Date(item.datetime).toISOString() : new Date().toISOString(),
          value: close,
          volatility,
          volume: toNumberOrNull(item?.volume) ?? 0
        };
      })
      .filter(Boolean);

    if (data.length === 0 && cached?.data) {
      return cached.data;
    }

    historyCache.set(cacheKey, { timestamp: now, data });
    return data;
  } catch (error) {
    if (cached?.data) {
      return cached.data;
    }
    throw error;
  }
};

const getPriceForPair = async (pair) => {
  const rates = await getLiveRates();
  const found = rates.find((rate) => rate.pair === pair);
  if (found) {
    return found;
  }

  throw new Error(`No live rate available for ${pair}.`);
};

export { getHistoricalRates, getLiveRates, getPriceForPair };
