import { getHistoricalFromCache, getLiveRatesFromCache } from "./marketCache.js";

const getLiveRates = async () => getLiveRatesFromCache();

const getHistoricalRates = async (pair, points = 60, opts = {}) => {
  const { interval = "1h" } = opts;
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
