import { getHistoricalRates } from "./rates.js";

const movingAverage = (values, period) => {
  if (values.length < period) {
    return null;
  }
  const slice = values.slice(-period);
  const sum = slice.reduce((acc, value) => acc + value, 0);
  return sum / period;
};

const standardDeviation = (values, period) => {
  if (values.length < period) {
    return null;
  }
  const slice = values.slice(-period);
  const mean = movingAverage(values, period);
  const variance = slice.reduce((acc, value) => acc + (value - mean) ** 2, 0) / period;
  return Math.sqrt(variance);
};

const buildCandles = (pair, points = 60) => {
  const history = getHistoricalRates(pair, points);
  return history.map((point) => {
    const spread = point.volatility || 0.002;
    return {
      timestamp: point.timestamp,
      open: point.value - spread * 0.3,
      high: point.value + spread * 0.6,
      low: point.value - spread * 0.6,
      close: point.value,
      volume: point.volume
    };
  });
};

const detectSupplyDemandZones = (candles) => {
  const zones = [];
  for (let index = 2; index < candles.length; index += 1) {
    const prev = candles[index - 1];
    const current = candles[index];
    const range = Math.abs(prev.close - prev.open);
    if (range < prev.close * 0.001 && Math.abs(current.close - prev.close) > prev.close * 0.0025) {
      zones.push({
        type: current.close > prev.close ? "demand" : "supply",
        start: prev.low,
        end: prev.high,
        timestamp: prev.timestamp
      });
    }
  }
  return zones.slice(-5);
};

const detectSmartMoney = (candles) => {
  const recent = candles.slice(-10);
  const avgVolume = recent.reduce((sum, candle) => sum + candle.volume, 0) / recent.length;
  const last = recent[recent.length - 1];
  const priceChange = last.close - last.open;
  const volumeSpike = last.volume > avgVolume * 1.4;

  if (volumeSpike && Math.abs(priceChange) < last.close * 0.001) {
    return {
      signal: priceChange >= 0 ? "accumulation" : "distribution",
      confidence: 75,
      rationale: "High volume with muted price change suggests institutional activity."
    };
  }

  return {
    signal: "neutral",
    confidence: 40,
    rationale: "No clear institutional footprint detected."
  };
};

const detectRubberBand = (candles, period = 50) => {
  const closes = candles.map((candle) => candle.close);
  const mean = movingAverage(closes, period);
  const deviation = standardDeviation(closes, period);
  if (!mean || !deviation) {
    return { stretch: 0, status: "insufficient" };
  }
  const current = closes[closes.length - 1];
  const stretch = (current - mean) / deviation;
  let status = "normal";
  if (Math.abs(stretch) >= 2.5) {
    status = "extreme";
  } else if (Math.abs(stretch) >= 1.5) {
    status = "moderate";
  }
  return { stretch: Number(stretch.toFixed(2)), status, mean, deviation };
};

const detectMultiTimeframeBias = (pair) => {
  const frames = [15, 60, 240];
  const signals = frames.map((points) => {
    const candles = buildCandles(pair, points);
    const closes = candles.map((candle) => candle.close);
    const mean = movingAverage(closes, Math.max(10, Math.floor(points / 3)));
    const current = closes[closes.length - 1];
    if (!mean) {
      return "neutral";
    }
    if (current > mean) {
      return "bullish";
    }
    if (current < mean) {
      return "bearish";
    }
    return "neutral";
  });

  const bullishCount = signals.filter((signal) => signal === "bullish").length;
  const bearishCount = signals.filter((signal) => signal === "bearish").length;

  let alignment = "mixed";
  if (bullishCount === signals.length) {
    alignment = "bullish";
  } else if (bearishCount === signals.length) {
    alignment = "bearish";
  }

  return { signals, alignment };
};

const buildFootprintSummary = (pair) => {
  const candles = buildCandles(pair, 60);
  const zones = detectSupplyDemandZones(candles);
  const smartMoney = detectSmartMoney(candles);
  const rubberBand = detectRubberBand(candles);
  const timeframeBias = detectMultiTimeframeBias(pair);

  return {
    pair,
    zones,
    smartMoney,
    rubberBand,
    timeframeBias
  };
};

export { buildFootprintSummary };
