import { basePrices, pairToSymbol, supportedPairs, symbolToPair } from "./marketSymbols.js";

const liveBySymbol = new Map();
const historyBySymbol = new Map();
const MAX_HISTORY_POINTS = 2000;

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

const recordTrade = ({ symbol, price, timestampMs }) => {
  if (!symbolToPair[symbol]) return;
  if (!Number.isFinite(price)) return;
  const ts = Number.isFinite(timestampMs) ? timestampMs : Date.now();

  liveBySymbol.set(symbol, { price, timestampMs: ts });

  const history = historyBySymbol.get(symbol) || [];
  history.push({ price, timestampMs: ts });
  if (history.length > MAX_HISTORY_POINTS) {
    history.splice(0, history.length - MAX_HISTORY_POINTS);
  }
  historyBySymbol.set(symbol, history);
};

const recordQuote = ({ symbol, bid, ask, timestampMs }) => {
  if (!symbolToPair[symbol]) return;
  const b = Number(bid);
  const a = Number(ask);
  if (!Number.isFinite(b) || !Number.isFinite(a)) return;
  const mid = (b + a) / 2;
  recordTrade({ symbol, price: mid, timestampMs });
};

const buildRateFromPrice = ({ pair, price, timestampMs }) => {
  const pip = pipSizeForPair(pair);
  const spread = pip * 1.5;
  const decimals = decimalsForPair(pair);
  const bid = roundTo(price - spread / 2, decimals);
  const ask = roundTo(price + spread / 2, decimals);
  return {
    pair,
    bid,
    ask,
    mid: roundTo(price, decimals),
    spread: roundTo(ask - bid, decimals),
    volume: 0,
    timestamp: new Date(timestampMs).toISOString()
  };
};

const getLiveRatesFromCache = () => {
  const now = Date.now();
  return supportedPairs.map((pair) => {
    const symbol = pairToSymbol[pair];
    const latest = symbol ? liveBySymbol.get(symbol) : null;
    const price = latest?.price ?? basePrices[pair];
    const ts = latest?.timestampMs ?? now;
    return buildRateFromPrice({ pair, price, timestampMs: ts });
  });
};

const getHistoricalFromCache = ({ pair, points, interval }) => {
  const symbol = pairToSymbol[pair];
  if (!symbol) {
    throw new Error(`Unsupported pair: ${pair}`);
  }

  const history = historyBySymbol.get(symbol) || [];
  const intervalMs = parseIntervalMs(interval);
  const now = Date.now();
  const fallbackPrice = basePrices[pair];

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

export { recordTrade, recordQuote, getLiveRatesFromCache, getHistoricalFromCache };
