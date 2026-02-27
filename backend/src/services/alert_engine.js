// Modernized alert engine implementing pip/ATR/percent/time/breakout filters.
// Mirrors the earlier Python prototype so the system can drop noise entirely.

import { pipSizeForPair } from "./marketValidator.js";
import prisma from "../db/prisma.js";

function isJpyPair(pair) {
  return pair.toUpperCase().includes("JPY");
}

function pipSize(pair) {
  return pipSizeForPair(pair) || (isJpyPair(pair) ? 0.01 : 0.0001);
}

function priceToPips(pair, diff) {
  return diff / pipSize(pair);
}

function percentageChange(ref, cur) {
  return ref === 0 ? 0 : ((cur - ref) / ref) * 100;
}

// fetch candles from database (oldest first)
export async function fetchCandles(pair, lookback) {
  // this is a simple helper; modify to suit your storage
  // lookback is number of candles, interval hardcoded to 1m here
  if (!prisma || !prisma.marketCandle) {
    // prisma unavailable; return empty array to allow engine to continue
    return [];
  }
  const candles = await prisma.marketCandle.findMany({
    where: { pair },
    orderBy: { bucketStart: "asc" },
    take: lookback
  });
  return candles.map((c) => ({
    ts: c.bucketStart.getTime() / 1000,
    high: c.high,
    low: c.low,
    close: c.close
  }));
}

function computeAtr(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const prevClose = candles[i - 1].close;
    const high = candles[i].high;
    const low = candles[i].low;
    trs.push(
      Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      )
    );
  }
  if (!trs.length) return null;
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

// configuration object mirroring Python dataclass
export class AlertConfig {
  constructor({
    pipThreshold,
    percentThreshold = null,
    atrMultiplier = 0.5,
    timeWindowMins = 5,
    spreadThresh = 5,
    cooldownSecs = 60,
    breakoutLookback = 20,
    useBreakout = false
  }) {
    this.pipThreshold = pipThreshold;
    this.percentThreshold = percentThreshold;
    this.atrMultiplier = atrMultiplier;
    this.timeWindowMins = timeWindowMins;
    this.spreadThresh = spreadThresh;
    this.cooldownSecs = cooldownSecs;
    this.breakoutLookback = breakoutLookback;
    this.useBreakout = useBreakout;
  }
}

export class ReferenceState {
  constructor() {
    this.lastAlertPrice = null;
    this.lastAlertTs = null;
    this.referencePrice = null;
  }
}

export class AlertEngine {
  constructor(pair, config, candleFetcher = fetchCandles, notifier = () => {}) {
    this.pair = pair;
    this.config = config;
    this.state = new ReferenceState();
    this.fetchCandles = candleFetcher;
    this.notifier = notifier;
  }

  _withinCooldown(price, ts) {
    if (!this.state.lastAlertTs) return false;
    const dt = ts - this.state.lastAlertTs;
    if (dt < this.config.cooldownSecs * 1000) {
      const extra = priceToPips(this.pair, Math.abs(price - this.state.lastAlertPrice));
      return extra < this.config.pipThreshold;
    }
    return false;
  }

  _checkSpread(bid, ask) {
    const spread = priceToPips(this.pair, ask - bid);
    return spread <= this.config.spreadThresh;
  }

  _checkPip(price) {
    const ref = this.state.referencePrice || price;
    const pips = priceToPips(this.pair, Math.abs(price - ref));
    return pips >= this.config.pipThreshold;
  }

  _checkPercent(price) {
    if (this.config.percentThreshold == null) return true;
    const ref = this.state.referencePrice || price;
    const pct = percentageChange(ref, price);
    return Math.abs(pct) >= this.config.percentThreshold;
  }

  async _checkAtr(price) {
    if (this.config.atrMultiplier <= 0) return true;
    const candles = await this.fetchCandles(this.pair, this.config.breakoutLookback + 1);
    const atr = computeAtr(candles, 14);
    if (atr == null) return true;
    const threshold = atr * this.config.atrMultiplier;
    return Math.abs(price - (this.state.referencePrice || price)) >= threshold;
  }

  async _checkRate(price, ts) {
    const lookbackMs = this.config.timeWindowMins * 60 * 1000;
    const candles = await this.fetchCandles(this.pair, 200);
    let lookbackCandle = null;
    for (let i = candles.length - 1; i >= 0; i--) {
      const c = candles[i];
      if (ts - c.ts * 1000 <= lookbackMs) {
        lookbackCandle = c;
      } else break;
    }
    if (!lookbackCandle) return true;
    const pips = priceToPips(this.pair, Math.abs(price - lookbackCandle.close));
    return pips >= this.config.pipThreshold;
  }

  async _checkBreakout(price) {
    if (!this.config.useBreakout) return true;
    const candles = await this.fetchCandles(this.pair, this.config.breakoutLookback);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    if (!highs.length || !lows.length) return true;
    const high = Math.max(...highs);
    const low = Math.min(...lows);
    return price > high || price < low;
  }

  async evaluateTick(bid, ask, price, ts) {
    if (!this._checkSpread(bid, ask)) return null;
    if (this._withinCooldown(price, ts)) return null;
    if (!this._checkPip(price)) return null;
    if (!this._checkPercent(price)) return null;
    if (!(await this._checkAtr(price))) return null;
    if (!(await this._checkRate(price, ts))) return null;
    if (!(await this._checkBreakout(price))) return null;

    const alert = { pair: this.pair, price, ts, bid, ask };
    this.notifier("price_alert", alert);
    this.state.lastAlertPrice = price;
    this.state.lastAlertTs = ts;
    this.state.referencePrice = price;
    return alert;
  }
}

// simple smoke tests (call manually if needed)
export async function demo() {
  const cfg = new AlertConfig({ pipThreshold: 5, atrMultiplier: 0.5, percentThreshold: 0.05, timeWindowMins: 2, spreadThresh: 2, cooldownSecs: 30, breakoutLookback: 10, useBreakout: true });
  const eng = new AlertEngine("EUR/USD", cfg, fetchCandles, (evt, data) => console.log("NOTIFY", evt, data));
  const now = Date.now();
  console.log("--noise"); await eng.evaluateTick(1,1.0001,1.0001,now);
  console.log("--big"); await eng.evaluateTick(1,1.0002,1.001,now+10000);
}

// Node ESM entrypoint guard: if the file is invoked directly via `node file.js`
if (import.meta.url === process.argv[1] || import.meta.url === `file://${process.argv[1]}`) {
  demo().then(() => process.exit(0));
}
