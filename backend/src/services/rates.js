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

const jitter = (value, variance = 0.002) => {
  const delta = (Math.random() * variance * 2) - variance;
  return Number((value + delta).toFixed(5));
};

const randomVolume = () => Math.floor(800 + Math.random() * 1200);

const getLiveRates = () =>
  Object.entries(basePrices).map(([pair, base]) => ({
    pair,
    bid: jitter(base * 0.9995),
    ask: jitter(base * 1.0005),
    mid: jitter(base),
    volume: randomVolume(),
    timestamp: new Date().toISOString()
  }));

const getHistoricalRates = (pair, points = 30) => {
  const base = basePrices[pair] || 1.0;
  const now = Date.now();
  return Array.from({ length: points }, (_, index) => {
    const timestamp = new Date(now - (points - index) * 3600 * 1000).toISOString();
    const volatility = 0.003 + Math.random() * 0.004;
    return {
      timestamp,
      value: jitter(base, volatility),
      volatility,
      volume: randomVolume()
    };
  });
};

const getPriceForPair = (pair) => {
  const base = basePrices[pair] || 1.0;
  return {
    bid: jitter(base * 0.9995),
    ask: jitter(base * 1.0005),
    mid: jitter(base)
  };
};

export { getHistoricalRates, getLiveRates, getPriceForPair };
