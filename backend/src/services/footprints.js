import { getHistoricalRates } from "./rates.js";

/**
 * Professional Footprints / Market Structure Signal Engine (SMC-style)
 * - Designed to act separately from your AI recommender.
 * - Outputs interpretable, structured signals with confidence + evidence.
 *
 * IMPORTANT:
 * This is candle-based approximation. True "footprint" requires tick/level-2/orderflow.
 */

/** -------------------------
 * Utils
 * ------------------------*/
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const isFiniteNumber = (v) => Number.isFinite(Number(v));
const round = (n, d = 5) => (isFiniteNumber(n) ? Number(Number(n).toFixed(d)) : null);

const sma = (values, period) => {
  if (!Array.isArray(values) || values.length < period) return null;
  const slice = values.slice(-period);
  const sum = slice.reduce((acc, v) => acc + v, 0);
  return sum / period;
};

const stdev = (values, period) => {
  if (!Array.isArray(values) || values.length < period) return null;
  const mean = sma(values, period);
  if (mean === null) return null;
  const slice = values.slice(-period);
  const variance = slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
  return Math.sqrt(variance);
};

const trueRange = (c, prevClose) => {
  if (!c) return null;
  const hL = c.high - c.low;
  const hPc = Math.abs(c.high - prevClose);
  const lPc = Math.abs(c.low - prevClose);
  return Math.max(hL, hPc, lPc);
};

const atr = (candles, period = 14) => {
  if (!Array.isArray(candles) || candles.length < period + 1) return null;
  const trs = [];
  for (let i = candles.length - period; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    trs.push(trueRange(curr, prev.close));
  }
  return trs.reduce((a, b) => a + b, 0) / trs.length;
};

const candleStats = (c) => {
  const body = Math.abs(c.close - c.open);
  const range = Math.max(1e-12, c.high - c.low);
  const upperWick = c.high - Math.max(c.open, c.close);
  const lowerWick = Math.min(c.open, c.close) - c.low;
  const bodyPct = body / range; // 0..1
  return { body, range, upperWick, lowerWick, bodyPct };
};

const percentile = (values, p) => {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
};

/** -------------------------
 * Candle builder
 * ------------------------*/
/**
 * buildCandles
 * Uses getHistoricalRates(pair, points) which returns { timestamp, value, volatility?, volume? }.
 * If you later replace that with real OHLCV candles from broker/exchange, plug them in here.
 */
const buildCandles = async (pair, points = 120, opts = {}) => {
  const {
    interval = "1h",
    syntheticSpreadFactor = 0.002, // only used if point.volatility missing
    ensureVolume = true,
    defaultVolume = 1
  } = opts;

  const history = await getHistoricalRates(pair, points, { interval });
  if (!Array.isArray(history) || history.length === 0) return [];

  return history.map((point) => {
    const open = Number(point.open);
    const high = Number(point.high);
    const low = Number(point.low);
    const close = Number(point.close);

    let resolvedOpen = open;
    let resolvedHigh = high;
    let resolvedLow = low;
    let resolvedClose = close;

    if (![open, high, low, close].every((v) => Number.isFinite(v))) {
      const v = Number(point.value);
      const vol = Number(point.volatility);
      const spread = Number.isFinite(vol) ? vol : syntheticSpreadFactor;

      // Synthetic OHLC approximation from a single value
      resolvedOpen = v - spread * 0.3;
      resolvedClose = v;
      resolvedHigh = v + spread * 0.6;
      resolvedLow = v - spread * 0.6;
    }

    const volume = ensureVolume
      ? Number.isFinite(Number(point.volume)) ? Number(point.volume) : defaultVolume
      : Number(point.volume);

    return {
      timestamp: point.timestamp,
      open: resolvedOpen,
      high: resolvedHigh,
      low: resolvedLow,
      close: resolvedClose,
      volume
    };
  });
};

/** -------------------------
 * Supply/Demand Zones (SMC-ish)
 * ------------------------*/
/**
 * Detect zones using a "base -> impulse" heuristic:
 * - Look for small-bodied candles (base) followed by strong displacement candle (impulse).
 * - Zone = base candle range (or small cluster) where imbalance started.
 */
const detectSupplyDemandZones = (candles, opts = {}) => {
  const {
    maxZones = 6,
    baseBodyMaxPct = 0.35,      // base candle is relatively small-bodied
    impulseBodyMinPct = 0.60,   // impulse candle is displacement
    impulseMinATRMult = 0.8,    // impulse range relative to ATR
    lookback = 80,
    zoneAgeLimit = 999999999    // can be used when timestamps are numeric
  } = opts;

  const zones = [];
  if (!Array.isArray(candles) || candles.length < 20) return zones;

  const recent = candles.slice(-lookback);
  const a = atr(recent, 14);

  for (let i = 2; i < recent.length; i++) {
    const base = recent[i - 1];
    const impulse = recent[i];

    const bStats = candleStats(base);
    const iStats = candleStats(impulse);

    const impulseRangeOK = a ? (iStats.range >= a * impulseMinATRMult) : true;
    const baseOK = bStats.bodyPct <= baseBodyMaxPct;
    const impulseOK = iStats.bodyPct >= impulseBodyMinPct;

    if (!baseOK || !impulseOK || !impulseRangeOK) continue;

    const direction = impulse.close > impulse.open ? "demand" : "supply";

    // Score zone strength:
    // - bigger impulse = stronger
    // - cleaner base = stronger
    const impulseScore = clamp((iStats.bodyPct - impulseBodyMinPct) / (1 - impulseBodyMinPct), 0, 1);
    const baseScore = clamp((baseBodyMaxPct - bStats.bodyPct) / baseBodyMaxPct, 0, 1);
    const confidence = Math.round(50 + 35 * impulseScore + 15 * baseScore);

    zones.push({
      type: direction,
      start: direction === "demand" ? base.low : base.low,
      end: direction === "demand" ? base.high : base.high,
      createdAt: base.timestamp,
      confidence,
      rationale:
        "Detected base-to-impulse move (displacement). Base candle range treated as origin zone.",
      evidence: {
        baseBodyPct: round(bStats.bodyPct, 3),
        impulseBodyPct: round(iStats.bodyPct, 3),
        atr14: round(a, 5),
        impulseRange: round(iStats.range, 5)
      }
    });
  }

  // De-duplicate similar zones (same type + overlapping)
  const merged = [];
  for (const z of zones) {
    const existing = merged.find(
      (m) =>
        m.type === z.type &&
        ((z.start >= m.start && z.start <= m.end) || (z.end >= m.start && z.end <= m.end))
    );
    if (!existing) {
      merged.push(z);
    } else {
      // Keep stronger
      if (z.confidence > existing.confidence) {
        existing.start = Math.min(existing.start, z.start);
        existing.end = Math.max(existing.end, z.end);
        existing.confidence = z.confidence;
        existing.createdAt = z.createdAt;
        existing.evidence = z.evidence;
      }
    }
  }

  return merged.slice(-maxZones);
};

/** -------------------------
 * Liquidity Sweeps (Stop runs)
 * ------------------------*/
/**
 * Detect a likely liquidity sweep:
 * - Candle wicks beyond prior swing high/low and closes back inside range.
 */
const detectLiquiditySweep = (candles, opts = {}) => {
  const { lookback = 30, swingWindow = 10 } = opts;
  if (!Array.isArray(candles) || candles.length < lookback + 2) {
    return { signal: "none", confidence: 0, rationale: "Insufficient data.", evidence: {} };
  }

  const recent = candles.slice(-lookback);
  const last = recent[recent.length - 1];
  const prevSlice = recent.slice(-swingWindow - 1, -1);

  const prevHigh = Math.max(...prevSlice.map((c) => c.high));
  const prevLow = Math.min(...prevSlice.map((c) => c.low));

  const sweptHigh = last.high > prevHigh && last.close < prevHigh;
  const sweptLow = last.low < prevLow && last.close > prevLow;

  if (sweptHigh || sweptLow) {
    const direction = sweptHigh ? "sweepHigh" : "sweepLow";
    const wickStrength = (() => {
      const st = candleStats(last);
      const wick = sweptHigh ? st.upperWick : st.lowerWick;
      return clamp(wick / st.range, 0, 1);
    })();

    const confidence = Math.round(60 + 35 * wickStrength);

    return {
      signal: direction,
      confidence,
      rationale:
        "Price swept a recent swing level and closed back inside, suggesting stop-run/liquidity grab.",
      evidence: {
        prevHigh: round(prevHigh, 5),
        prevLow: round(prevLow, 5),
        lastHigh: round(last.high, 5),
        lastLow: round(last.low, 5),
        lastClose: round(last.close, 5)
      }
    };
  }

  return {
    signal: "none",
    confidence: 35,
    rationale: "No clear swing-level sweep on the latest candle.",
    evidence: { prevHigh: round(prevHigh, 5), prevLow: round(prevLow, 5) }
  };
};

/** -------------------------
 * Smart Money Footprints (Effort vs Result)
 * ------------------------*/
/**
 * Candle+volume-based approximation:
 * - Volume spike + small real body = absorption (effort high, result low)
 * - Large displacement + volume = initiative move
 */
const detectSmartMoney = (candles, opts = {}) => {
  const { lookback = 30, volSpikeMult = 1.6 } = opts;
  if (!Array.isArray(candles) || candles.length < lookback) {
    return { signal: "neutral", confidence: 0, rationale: "Insufficient data.", evidence: {} };
  }

  const recent = candles.slice(-lookback);
  const vols = recent.map((c) => c.volume);
  const last = recent[recent.length - 1];
  const lastStats = candleStats(last);

  const volMed = percentile(vols, 50) ?? 0;
  const volP80 = percentile(vols, 80) ?? volMed;

  const isSpike = last.volume >= Math.max(volP80, volMed * volSpikeMult);
  const smallBody = lastStats.bodyPct <= 0.28; // absorption tendency
  const bigBody = lastStats.bodyPct >= 0.65;   // displacement tendency

  // Directional inference: wick imbalance + close position
  const closeNearHigh = (last.close - last.low) / Math.max(1e-12, lastStats.range) > 0.75;
  const closeNearLow = (last.close - last.low) / Math.max(1e-12, lastStats.range) < 0.25;

  if (isSpike && smallBody) {
    // absorption footprint
    const signal = closeNearHigh ? "accumulation" : closeNearLow ? "distribution" : "absorption";
    const confidence = Math.round(70 + 20 * clamp((last.volume - volP80) / Math.max(1e-12, volP80), 0, 1));

    return {
      signal,
      confidence,
      rationale:
        "Volume spike with muted real body suggests absorption (effort vs result), often linked to institutional activity.",
      evidence: {
        lastVolume: round(last.volume, 2),
        volMedian: round(volMed, 2),
        volP80: round(volP80, 2),
        bodyPct: round(lastStats.bodyPct, 3),
        closeNearHigh,
        closeNearLow
      }
    };
  }

  if (isSpike && bigBody) {
    const signal = last.close > last.open ? "initiativeBuy" : "initiativeSell";
    const confidence = Math.round(60 + 30 * clamp((lastStats.bodyPct - 0.65) / 0.35, 0, 1));

    return {
      signal,
      confidence,
      rationale:
        "Large displacement candle with elevated volume suggests an initiative move (strong participation).",
      evidence: {
        lastVolume: round(last.volume, 2),
        volP80: round(volP80, 2),
        bodyPct: round(lastStats.bodyPct, 3)
      }
    };
  }

  return {
    signal: "neutral",
    confidence: 45,
    rationale: "No strong effort-vs-result or displacement footprint detected.",
    evidence: {
      lastVolume: round(last.volume, 2),
      volMedian: round(volMed, 2),
      bodyPct: round(lastStats.bodyPct, 3)
    }
  };
};

/** -------------------------
 * Displacement + Imbalance (FVG proxy)
 * ------------------------*/
/**
 * FVG proxy (3-candle imbalance approximation):
 * bullish: candle[i-2].high < candle[i].low
 * bearish: candle[i-2].low  > candle[i].high
 */
const detectImbalanceFVG = (candles, opts = {}) => {
  const { lookback = 60, maxFVG = 4 } = opts;
  if (!Array.isArray(candles) || candles.length < 10) return [];

  const recent = candles.slice(-lookback);
  const fvgs = [];

  for (let i = 2; i < recent.length; i++) {
    const a = recent[i - 2];
    const c = recent[i];

    const bullish = a.high < c.low;
    const bearish = a.low > c.high;

    if (bullish) {
      fvgs.push({
        type: "bullishFVG",
        from: a.high,
        to: c.low,
        createdAt: recent[i - 1].timestamp,
        confidence: 65,
        rationale: "Detected bullish imbalance (price skipped levels quickly)."
      });
    } else if (bearish) {
      fvgs.push({
        type: "bearishFVG",
        from: c.high,
        to: a.low,
        createdAt: recent[i - 1].timestamp,
        confidence: 65,
        rationale: "Detected bearish imbalance (price skipped levels quickly)."
      });
    }
  }

  return fvgs.slice(-maxFVG);
};

/** -------------------------
 * Rubber Band (mean reversion stretch)
 * ------------------------*/
const detectRubberBand = (candles, opts = {}) => {
  const { period = 50, extremeZ = 2.5, moderateZ = 1.5 } = opts;
  if (!Array.isArray(candles) || candles.length < period + 5) {
    return { stretchZ: 0, status: "insufficient", confidence: 0, rationale: "Insufficient data." };
  }

  const closes = candles.map((c) => c.close);
  const mean = sma(closes, period);
  const sd = stdev(closes, period);
  if (!mean || !sd) {
    return { stretchZ: 0, status: "insufficient", confidence: 0, rationale: "Insufficient data." };
  }

  const current = closes[closes.length - 1];
  const z = (current - mean) / Math.max(1e-12, sd);

  let status = "normal";
  let confidence = 55;
  if (Math.abs(z) >= extremeZ) {
    status = "extreme";
    confidence = 80;
  } else if (Math.abs(z) >= moderateZ) {
    status = "moderate";
    confidence = 68;
  }

  const direction = z > 0 ? "overextendedUp" : z < 0 ? "overextendedDown" : "neutral";

  return {
    stretchZ: round(z, 2),
    status,
    direction,
    mean: round(mean, 5),
    deviation: round(sd, 5),
    confidence,
    rationale:
      status === "normal"
        ? "Price is near statistical equilibrium (limited mean-reversion pressure)."
        : "Price is stretched from equilibrium (mean-reversion pressure elevated)."
  };
};

/** -------------------------
 * Multi-Timeframe Bias (simple but consistent)
 * ------------------------*/
const detectMultiTimeframeBias = async (pair, opts = {}) => {
  const {
    frames = [
      { label: "D1", interval: "1d", points: 180, maPeriod: 50 },
      { label: "H4", interval: "4h", points: 240, maPeriod: 60 },
      { label: "H1", interval: "1h", points: 240, maPeriod: 60 },
      { label: "M15", interval: "15m", points: 240, maPeriod: 60 },
      { label: "M1", interval: "1m", points: 300, maPeriod: 100 }
    ],
    candleOpts = {}
  } = opts;

  const results = await Promise.all(frames.map(async (f) => {
    const candles = await buildCandles(pair, f.points, { ...candleOpts, interval: f.interval || "1h" });
    if (candles.length < f.maPeriod + 5) {
      return {
        timeframe: f.label,
        bias: "neutral",
        confidence: 0,
        rationale: "Insufficient candles for bias calculation."
      };
    }

    const closes = candles.map((c) => c.close);
    const mean = sma(closes, f.maPeriod);
    const sd = stdev(closes, f.maPeriod) || 0;
    const last = closes[closes.length - 1];

    // Bias based on distance from MA in sd units (simple, stable)
    const z = sd > 0 ? (last - mean) / sd : 0;
    let bias = "neutral";
    if (z > 0.3) bias = "bullish";
    if (z < -0.3) bias = "bearish";

    const confidence = Math.round(clamp(50 + Math.abs(z) * 15, 45, 85));

    return {
      timeframe: f.label,
      bias,
      confidence,
      rationale: "Bias derived from price distance to rolling mean (normalized by volatility).",
      evidence: { z: round(z, 2), ma: round(mean, 5), sd: round(sd, 5), last: round(last, 5) }
    };
  }));

  const bullish = results.filter((r) => r.bias === "bullish").length;
  const bearish = results.filter((r) => r.bias === "bearish").length;

  let alignment = "mixed";
  if (bullish === results.length) alignment = "bullish";
  else if (bearish === results.length) alignment = "bearish";

  const alignmentConfidence = Math.round(
    clamp(
      50 + (Math.max(bullish, bearish) / Math.max(1, results.length)) * 40,
      50,
      90
    )
  );

  return { signals: results, alignment, confidence: alignmentConfidence };
};

/** -------------------------
 * Overall summary builder
 * ------------------------*/
const buildFootprintSummary = async (pair, opts = {}) => {
  const {
    points = 180,
    candleOpts = {},
    zonesOpts = {},
    sweepOpts = {},
    smartMoneyOpts = {},
    rubberBandOpts = {},
    mtfOpts = {}
  } = opts;

  const candles = await buildCandles(pair, points, candleOpts);

  if (!candles.length) {
    return {
      pair,
      status: "error",
      message: "No candle data available.",
      signals: {}
    };
  }

  const zones = detectSupplyDemandZones(candles, zonesOpts);
  const liquiditySweep = detectLiquiditySweep(candles, sweepOpts);
  const smartMoney = detectSmartMoney(candles, smartMoneyOpts);
  const rubberBand = detectRubberBand(candles, rubberBandOpts);
  const imbalanceFVG = detectImbalanceFVG(candles, { lookback: 80, maxFVG: 5 });
  const timeframeBias = await detectMultiTimeframeBias(pair, { ...mtfOpts, candleOpts });

  // Professional “composite” sentiment (NOT a trade call, just environment scoring)
  const composite = (() => {
    let score = 0; // -100..+100
    const notes = [];

    // Timeframe alignment drives environment confidence
    if (timeframeBias.alignment === "bullish") {
      score += 25;
      notes.push("HTF alignment bullish.");
    } else if (timeframeBias.alignment === "bearish") {
      score -= 25;
      notes.push("HTF alignment bearish.");
    } else {
      notes.push("HTF alignment mixed.");
    }

    // Smart money footprints
    if (smartMoney.signal === "initiativeBuy") score += 20;
    if (smartMoney.signal === "initiativeSell") score -= 20;
    if (smartMoney.signal === "accumulation") score += 12;
    if (smartMoney.signal === "distribution") score -= 12;

    // Liquidity sweeps often precede reversal; we don’t force direction, but we flag it
    if (liquiditySweep.signal === "sweepLow") {
      notes.push("Possible sweep of lows (reversal potential).");
      score += 5;
    }
    if (liquiditySweep.signal === "sweepHigh") {
      notes.push("Possible sweep of highs (reversal potential).");
      score -= 5;
    }

    // Rubber band (mean reversion pressure)
    if (rubberBand.status === "extreme") notes.push("Mean-reversion pressure: EXTREME.");
    if (rubberBand.status === "moderate") notes.push("Mean-reversion pressure: MODERATE.");

    score = clamp(score, -100, 100);
    const environment = score >= 20 ? "bullish" : score <= -20 ? "bearish" : "neutral";

    const confidence = Math.round(
      clamp(
        45 +
          (Math.abs(score) / 100) * 30 +
          (smartMoney.confidence / 100) * 10 +
          (timeframeBias.confidence / 100) * 15,
        45,
        92
      )
    );

    return { environment, score, confidence, notes };
  })();

  return {
    pair,
    status: "ok",
    generatedAt: new Date().toISOString(),
    signals: {
      zones,
      imbalanceFVG,
      liquiditySweep,
      smartMoney,
      rubberBand,
      timeframeBias,
      composite
    }
  };
};

export { buildFootprintSummary };
