const isJpyPair = (pair) => typeof pair === "string" && pair.includes("JPY");
const decimalsForPair = (pair) => (isJpyPair(pair) ? 3 : 5);

const normalizeTimeframeToInterval = (timeframe) => {
  if (typeof timeframe !== "string") return null;
  const raw = timeframe.trim().toLowerCase().replace(/\s+/g, "");
  if (!raw) return null;

  // Common variants: "M15", "H1", "H4", "D1"
  const m1 = raw.match(/^m(\d+)$/);
  if (m1) return `${Number(m1[1])}m`;
  const h1 = raw.match(/^h(\d+)$/);
  if (h1) return `${Number(h1[1])}h`;
  const d1 = raw.match(/^d(\d+)$/);
  if (d1) return `${Number(d1[1])}d`;

  // "1m", "15m", "1h", "4h", "1d", plus "1hr"/"4hr"
  const normalized = raw.replace(/hrs?|hours?/g, "h").replace(/mins?|minutes?/g, "m").replace(/days?/g, "d");
  const match = normalized.match(/^(\d+)(m|h|d)$/);
  if (!match) return null;
  return `${Number(match[1])}${match[2]}`;
};

const defaultFootprintPointsForInterval = (interval) => {
  switch (interval) {
    case "1m":
      return 360; // ~6h
    case "15m":
      return 240; // ~60h
    case "1h":
      return 240; // ~10d
    case "4h":
      return 240; // ~40d
    case "1d":
      return 180; // ~6m
    default:
      return 180;
  }
};

const computePipValuePerLot = ({ pair, price, accountCurrency = "USD" }) => {
  // For now we only compute USD pip value because supportedPairs are USD-quoted/based.
  if (accountCurrency !== "USD") return null;
  if (typeof pair !== "string" || !pair.includes("/")) return null;
  if (!Number.isFinite(Number(price)) || Number(price) <= 0) return null;

  const [base, quote] = pair.split("/");
  const isJpy = quote === "JPY";
  const pipSize = isJpy ? 0.01 : 0.0001;
  const lotSize = 100000;
  const pipValueInQuote = pipSize * lotSize; // 10 quote units per pip (or 1000 JPY)

  // X/USD: pip value already in USD.
  if (quote === "USD") return pipValueInQuote;

  // USD/X: quote currency pip value converted to USD by dividing by USD/X rate.
  if (base === "USD") return pipValueInQuote / Number(price);

  return null;
};

const getSessionUtc = (date = new Date()) => {
  const h = date.getUTCHours();
  // Rough institutional session mapping in UTC.
  // ASIA: 22-07, LONDON: 07-13, NY: 13-22
  if (h >= 22 || h < 7) return "ASIA";
  if (h >= 7 && h < 13) return "LONDON";
  return "NY";
};

const extractKeyLevelsHint = ({ footprint, pair, maxLevels = 12 }) => {
  const decimals = decimalsForPair(pair);
  const seen = new Set();
  const out = [];

  const push = (n) => {
    if (!Number.isFinite(Number(n))) return;
    const rounded = Number(Number(n).toFixed(decimals));
    const key = rounded.toFixed(decimals);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(rounded);
  };

  const zones = footprint?.signals?.zones;
  if (Array.isArray(zones)) {
    zones.forEach((z) => {
      push(z?.start);
      push(z?.end);
    });
  }

  const fvgs = footprint?.signals?.imbalanceFVG;
  if (Array.isArray(fvgs)) {
    fvgs.forEach((f) => {
      push(f?.from);
      push(f?.to);
    });
  }

  // Sort and cap
  out.sort((a, b) => a - b);
  return out.slice(0, Math.max(0, maxLevels));
};

export {
  normalizeTimeframeToInterval,
  defaultFootprintPointsForInterval,
  computePipValuePerLot,
  getSessionUtc,
  extractKeyLevelsHint
};

