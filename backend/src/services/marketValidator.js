
// Utility helpers for tick validation, outlier detection, and diagnostics

// determine decimal precision based on JPY vs non-JPY pairs (same logic as marketCache)
const isJpyPair = (pair) => String(pair).includes("JPY");
const decimalsForPair = (pair) => (isJpyPair(pair) ? 3 : 5);
const pipSizeForPair = (pair) => (isJpyPair(pair) ? 0.01 : 0.0001);

// configuration helpers (environment variables can override defaults)
const MAX_TICK_RETURN_PERCENT = Number(process.env.MARKET_ALERT_MAX_TICK_RETURN_PERCENT || 0.005); // 0.5% per tick
const OUTLIER_ZSCORE = Number(process.env.MARKET_ALERT_OUTLIER_ZSCORE || 5);

// Validate a tick before it enters the alert engine. Returns an object
// detailing whether the tick is acceptable and any reasons for rejection.
export const validateTick = ({ pair, tsMs, price, priceType }) => {
  const issues = [];
  if (!pair || typeof pair !== "string") issues.push("invalid or missing pair");
  if (!Number.isFinite(price) || price <= 0) issues.push("price not positive finite");
  if (!Number.isFinite(tsMs) || tsMs <= 0) issues.push("timestamp invalid");
  const allowed = ["mid", "last", "bid", "ask"];
  if (!allowed.includes(priceType)) issues.push(`unsupported priceType=${priceType}`);

  // strict pip scaling check: price must be an integer multiple of the instrument's
  // pip size.  Failing this usually indicates bad parsing or a cross-instrument feed
  // mixup.
  if (issues.length === 0) {
    const pip = pipSizeForPair(pair);
    const multiplier = 1 / pip;
    if (Math.abs(Math.round(price * multiplier) - price * multiplier) > Number.EPSILON) {
      issues.push(`price not multiple of pip (${pip})`);
    }
  }

  return {
    ok: issues.length === 0,
    issues
  };
};

// simple rolling outlier detector using z-score and absolute move caps.  The
// check only considers ticks of the same priceType, and the absolute cap is
// configurable via `MARKET_ALERT_MAX_TICK_RETURN_PERCENT` (default 0.5%).
export const isTickOutlier = (ticks, newTick) => {
  if (!Array.isArray(ticks)) return false;
  const sameType = ticks.filter((t) => t.priceType === newTick.priceType && !t.outlier);
  const n = sameType.length;
  if (n < 2) return false;

  // compute tick-to-tick returns on recent subset (last 20 entries)
  const slice = sameType.slice(Math.max(0, n - 20));
  const returns = [];
  for (let i = 1; i < slice.length; i += 1) {
    const prev = slice[i - 1].price;
    const cur = slice[i].price;
    if (prev !== 0) returns.push((cur - prev) / prev);
  }
  if (returns.length < 2) return false;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  const std = Math.sqrt(variance);

  const lastPrice = slice[slice.length - 1].price;
  const ret = lastPrice !== 0 ? (newTick.price - lastPrice) / lastPrice : 0;

  // absolute cap first – anything beyond a few tenths of a percent per tick is
  // considered nonsense in an institutional stream.
  if (Math.abs(ret) > MAX_TICK_RETURN_PERCENT) return true;

  // then statistical z‑score check against recent history
  if (std > 0 && Math.abs(ret - mean) > OUTLIER_ZSCORE * std) return true;

  return false;
};

// structured diagnostic logging helper
export const logDiagnostic = (data) => {
  // only output when environment variable enabled; default off
  if (process.env.MARKET_ALERT_DIAGNOSTICS !== "true") return;
  try {
    console.debug("[MarketRecorder][diag]", JSON.stringify(data));
  } catch {}
};
