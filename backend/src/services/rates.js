import prisma from "../db/prisma.js";
import { getHistoricalFromCache, getLiveRatesFromCache } from "./marketCache.js";

const getLiveRates = async () => getLiveRatesFromCache();

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
        return candles
          .slice()
          .reverse()
          .map((c) => ({
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
