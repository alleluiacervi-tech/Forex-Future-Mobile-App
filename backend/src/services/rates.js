import prisma from "../db/prisma.js";
import { getHistoricalFromCache, getLiveRatesFromCache } from "./marketCache.js";

const getLiveRates = async () => getLiveRatesFromCache();

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

const getHistoricalRates = async (pair, points = 60, opts = {}) => {
  const { interval = "1h" } = opts;

  if (prisma.marketCandle) {
    try {
      const candles = await prisma.marketCandle.findMany({
        where: { pair, interval },
        orderBy: { bucketStart: "desc" },
        take: points
      });

      if (Array.isArray(candles) && candles.length > 0) {
        const intervalMs = parseIntervalMs(interval);
        const ascending = candles.slice().reverse();

        // If we don't have enough DB candles yet, left-pad with synthetic candles
        // so callers always get the requested number of points.
        if (ascending.length < points && intervalMs > 0) {
          const missing = points - ascending.length;
          const anchor = ascending[0];
          const anchorTs = anchor?.bucketStart ? anchor.bucketStart.getTime() : Date.now();
          const anchorPrice = Number.isFinite(Number(anchor?.open))
            ? Number(anchor.open)
            : Number.isFinite(Number(anchor?.close))
              ? Number(anchor.close)
              : null;

          if (Number.isFinite(anchorPrice)) {
            for (let i = missing; i >= 1; i -= 1) {
              const ts = new Date(anchorTs - i * intervalMs).toISOString();
              ascending.unshift({
                bucketStart: new Date(ts),
                open: anchorPrice,
                high: anchorPrice,
                low: anchorPrice,
                close: anchorPrice,
                volume: 0
              });
            }
          }
        }

        return ascending.slice(-points).map((c) => ({
          timestamp: c.bucketStart.toISOString(),
          value: c.close,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volatility: Math.abs(c.high - c.low),
          volume: c.volume ?? 0
        }));
      }
    } catch {
      // fall back to cache
    }
  }

  return getHistoricalFromCache({ pair, points, interval });
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
