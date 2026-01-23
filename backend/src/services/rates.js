/**
 * Professional Simulated FX Market Data Engine (for demo/dev)
 * - NOT real market data
 * - Produces more realistic behavior than pure jitter:
 *   random walk + volatility regimes + spread dynamics + correct decimal precision
 */

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

/** ---- Pair conventions ---- */
const isJpyPair = (pair) => pair.includes("JPY");
const decimalsForPair = (pair) => (isJpyPair(pair) ? 3 : 5); // mid/bid/ask rounding
const pipSizeForPair = (pair) => (isJpyPair(pair) ? 0.01 : 0.0001);

/** ---- RNG helpers (optional deterministic seed) ---- */
let _seed = null; // set to a number for deterministic output

const setSeed = (seed) => {
  _seed = Number.isFinite(seed) ? seed : null;
};

// Mulberry32 PRNG for determinism in tests (only used if _seed is set)
const mulberry32 = (a) => () => {
  let t = (a += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const rand = (() => {
  let prng = null;
  return () => {
    if (_seed === null) return Math.random();
    if (!prng) prng = mulberry32(_seed);
    return prng();
  };
})();

/** Standard normal (Box-Muller) */
const randn = () => {
  let u = 0,
    v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

const roundTo = (value, decimals) => Number(Number(value).toFixed(decimals));

/** ---- Market state per pair (drift + volatility regime) ---- */
const pairState = new Map();
/**
 * Initialize state if needed:
 * - drift: tiny directional bias
 * - regime: CALM/NORMAL/HIGH (switches slowly)
 */
const initState = (pair) => {
  if (pairState.has(pair)) return;

  pairState.set(pair, {
    mid: basePrices[pair] ?? 1.0,
    drift: (rand() - 0.5) * 0.00002, // tiny drift
    regime: "NORMAL",
    regimeStrength: 0.5 + rand() * 0.5 // 0.5..1.0
  });
};

const maybeSwitchRegime = (state) => {
  // Small chance to switch regime; more stable than random every call
  const r = rand();
  if (r < 0.02) state.regime = "CALM";
  else if (r < 0.96) state.regime = "NORMAL";
  else state.regime = "HIGH";

  // regimeStrength slowly fluctuates
  state.regimeStrength = Math.max(0.3, Math.min(1.3, state.regimeStrength + (rand() - 0.5) * 0.05));
};

const volatilityForPair = (pair, state) => {
  const pip = pipSizeForPair(pair);

  // Volatility scales by regime
  // These are per-step vol estimates (not annualized)
  const base = state.regime === "CALM" ? 6 : state.regime === "HIGH" ? 20 : 12; // in pips
  const pips = base * state.regimeStrength;

  return pips * pip;
};

const spreadForPair = (pair, state) => {
  const pip = pipSizeForPair(pair);

  // Typical spreads (in pips), widen in HIGH regime
  const typical = isJpyPair(pair) ? 1.2 : 1.0;
  const widen = state.regime === "HIGH" ? 1.8 : state.regime === "CALM" ? 0.8 : 1.2;

  // Add small randomness
  const spreadPips = Math.max(0.6, typical * widen + (rand() - 0.5) * 0.3);
  return spreadPips * pip;
};

const volumeForState = (state) => {
  // Volume correlates with volatility regime (for realism)
  const base = 700;
  const boost = state.regime === "HIGH" ? 1400 : state.regime === "CALM" ? 500 : 900;
  const noise = Math.floor(rand() * 400);
  return base + boost + noise;
};

/**
 * One step price evolution: random walk + drift + mild mean reversion to base price.
 * This creates realistic "wiggle" without pure jitter.
 */
const evolveMidPrice = (pair, state) => {
  maybeSwitchRegime(state);

  const vol = volatilityForPair(pair, state);
  const base = basePrices[pair] ?? 1.0;

  // Random shock
  const shock = randn() * vol;

  // Mild mean reversion to base (keeps sim stable over time)
  const meanRevert = (base - state.mid) * 0.02;

  // Drift (slow)
  const drift = state.drift;

  state.mid = Math.max(0.00001, state.mid + shock + meanRevert + drift);
  return state.mid;
};

/** ---- Public API ---- */
const getPriceForPair = (pair) => {
  initState(pair);
  const state = pairState.get(pair);

  const midRaw = evolveMidPrice(pair, state);
  const spread = spreadForPair(pair, state);

  const decimals = decimalsForPair(pair);
  const mid = roundTo(midRaw, decimals);
  const bid = roundTo(midRaw - spread / 2, decimals);
  const ask = roundTo(midRaw + spread / 2, decimals);

  return {
    bid,
    ask,
    mid,
    spread: roundTo(ask - bid, decimals),
    regime: state.regime
  };
};

const getLiveRates = () => {
  const timestamp = new Date().toISOString();

  return Object.keys(basePrices).map((pair) => {
    const px = getPriceForPair(pair);
    initState(pair);
    const state = pairState.get(pair);

    return {
      pair,
      bid: px.bid,
      ask: px.ask,
      mid: px.mid,
      spread: px.spread,
      regime: px.regime,
      volume: volumeForState(state),
      timestamp
    };
  });
};

/**
 * getHistoricalRates
 * Generates synthetic historical points:
 * - uses same evolution function, but steps backward in time
 * - For demo: timeframe is "1H" per point by default
 *
 * NOTE: This produces {timestamp, value, volatility, volume}
 * to match your existing candle builder.
 */
const getHistoricalRates = (pair, points = 60, opts = {}) => {
  const { stepMs = 60 * 60 * 1000 } = opts; // 1 hour per point
  initState(pair);

  // Create a local copy so we don't mutate live state in a big historical request
  const original = pairState.get(pair);
  const localState = { ...original };

  const now = Date.now();
  const out = [];

  // Start near base price and "walk forward" generating past series (reverse at the end)
  localState.mid = basePrices[pair] ?? 1.0;

  for (let i = 0; i < points; i++) {
    const ts = new Date(now - (points - i) * stepMs).toISOString();
    evolveMidPrice(pair, localState);

    const vol = volatilityForPair(pair, localState);
    const volume = volumeForState(localState);

    out.push({
      timestamp: ts,
      value: roundTo(localState.mid, decimalsForPair(pair)),
      volatility: vol,
      volume
    });
  }

  return out;
};

export { getHistoricalRates, getLiveRates, getPriceForPair, setSeed };
