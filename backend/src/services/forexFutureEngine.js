// Ultra-fast predictive detection engine and institutional footprint system
// based on requirements from project spec (velocity layers, acceleration,
// smart money signals, confluence, etc).  Pure JavaScript, Node.js compatible
// with no external dependencies beyond built-in modules.

import { pipSizeForPair, decimalsForPair } from "./marketValidator.js";
import crypto from "crypto";

// -----------------------------------------------------------------------------
// configuration object – all thresholds and tunables live here so they can be
// modified at runtime without touching the logic below.
// -----------------------------------------------------------------------------
const CONFIG = {
  tickBufferSize: 500,
  candleHistorySize: 200,

  // velocity detection parameters
  velocity: {
    windows: [
      { name: "micro", ms: 500 },
      { name: "ultra", ms: 2000 },
      { name: "fast", ms: 5000 },
      { name: "medium", ms: 15000 },
      { name: "slow", ms: 30000 },
      { name: "trend", ms: 60000 }
    ],
    baseline: {
      EURUSD: 0.15,
      GBPUSD: 0.20,
      USDJPY: 0.18,
      AUDUSD: 0.12,
      USDCHF: 0.14,
      GBPJPY: 0.25,
      EURJPY: 0.20,
      USDCAD: 0.15
    }
  },
  accelerationThresholds: {
    microBurst: 3.0,
    accelerationSpike: 6.0,
    sustainedSurge: 4.0
  },
  velocityMultipliers: {
    microBurst: 3,
    velocityExplosion: 8,
    sustainedSurge: 4,
    accelerationSpike: 6
  },
  strengthMultipliers: {
    EARLY: 3,
    STRONG: 6,
    EXPLOSIVE: 10,
    CRASH: 15
  },
  entrySLTP: {
    EARLY: { sl: 8, tp: 15 },
    STRONG: { sl: 12, tp: 30 },
    EXPLOSIVE: { sl: 18, tp: 55 },
    CRASH: { sl: 25, tp: 80 }
  },
  cooldowns: {
    base: 30000,
    micro: 15000,
    crashBypass: true
  },
  earlyPercent: {
    500: 95,
    2000: 85,
    5000: 70,
    15000: 50,
    30000: 30,
    60000: 30
  },
  confluenceWeights: {
    velocity: 20,
    liquiditySweep: 30,
    orderBlock: 20,
    fvg: 15,
    bos: 25,
    choch: 15,
    volume: 20,
    spread: 25,
    eql: 15,
    sameDirection: 10
  },
  confidenceLabels: [
    { min: 100, label: "MAXIMUM" },
    { min: 80, label: "VERY_HIGH" },
    { min: 60, label: "HIGH" },
    { min: 40, label: "MODERATE" },
    { min: 0, label: "LOW" }
  ],
  cleanupIntervalMs: 60000
};

// utils //////////////////////////////////////////////////////////////////////
const nowMs = () => Date.now();

const getPipSize = (pair) => pipSizeForPair(pair) || 0.0001;
const pipsToPrice = (pips, pair) => pips * getPipSize(pair);
const priceToPips = (diff, pair) => {
  const pip = getPipSize(pair);
  if (!pip) return 0;
  return diff / pip;
};

// -----------------------------------------------------------------------------
// tick buffer for each currency pair – circular with capacity limit.  stores
// tick objects {tsMs, price, priceType, bid?, ask?} and keeps a small spread
// history for spread-spike detection.
// -----------------------------------------------------------------------------
class TickBuffer {
  constructor(pair) {
    this.pair = pair;
    this.maxSize = CONFIG.tickBufferSize;
    this.buffer = [];
    this.lastVelocities = new Map(); // windowMs -> last velocity value
    this.spreadHistory = [];
  }

  addTick(tick) {
    const { tsMs, price, priceType, bid, ask } = tick;
    this.buffer.push({ tsMs, price, priceType, bid, ask });
    if (this.buffer.length > this.maxSize) this.buffer.shift();
    if (bid != null && ask != null) {
      const spread = ask - bid;
      this.spreadHistory.push(spread);
      if (this.spreadHistory.length > 50) this.spreadHistory.shift();
    }
  }

  // compute velocity over the given window (ms) returning an object or null
  getVelocity(windowMs) {
    if (this.buffer.length < 2) return null;
    const now = this.buffer[this.buffer.length - 1].tsMs;
    const cutoff = now - windowMs;
    let earliest = null;
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (this.buffer[i].tsMs <= cutoff) {
        earliest = this.buffer[i];
        break;
      }
    }
    if (!earliest) return null;
    const last = this.buffer[this.buffer.length - 1];
    const diff = last.price - earliest.price;
    const pips = priceToPips(diff, this.pair);
    const seconds = (last.tsMs - earliest.tsMs) / 1000;
    if (seconds <= 0) return null;
    const velocity = pips / seconds;
    const prev = this.lastVelocities.get(windowMs) || null;
    const accel = prev && prev > 0 ? velocity / prev : 1;
    this.lastVelocities.set(windowMs, velocity);
    return { velocity, acceleration: accel, windowMs };
  }

  averageSpread() {
    if (!this.spreadHistory.length) return null;
    const sum = this.spreadHistory.reduce((a, b) => a + b, 0);
    return sum / this.spreadHistory.length;
  }
}

// -----------------------------------------------------------------------------
// Candle builder for various timeframes; pushes closed candles into a history
// array and keeps current open candle.  Maintains at most `CONFIG.candleHistorySize`
// candles per timeframe.
// -----------------------------------------------------------------------------
class CandleBuilder {
  constructor(pair) {
    this.pair = pair;
    this.intervals = [60000, 3 * 60000, 5 * 60000, 15 * 60000]; // ms
    // map interval -> {current: candle, history: []}
    this.data = new Map();
    for (const ms of this.intervals) {
      this.data.set(ms, { current: null, history: [] });
    }
  }

  // tick: {tsMs, price, volume}
  addTick(tick) {
    const { tsMs, price, volume } = tick;
    for (const ms of this.intervals) {
      const bucketStart = Math.floor(tsMs / ms) * ms;
      const entry = this.data.get(ms);
      if (!entry.current || entry.current.start !== bucketStart) {
        // close previous candle
        if (entry.current) {
          entry.history.push(entry.current);
          if (entry.history.length > CONFIG.candleHistorySize) entry.history.shift();
        }
        // start new candle
        entry.current = {
          start: bucketStart,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: volume || 0
        };
      } else {
        // update existing
        entry.current.high = Math.max(entry.current.high, price);
        entry.current.low = Math.min(entry.current.low, price);
        entry.current.close = price;
        if (volume) entry.current.volume += volume;
      }
    }
  }

  // helper to get last n closed candles for an interval (ms)
  getHistory(intervalMs, n = 200) {
    const entry = this.data.get(intervalMs);
    if (!entry) return [];
    const h = entry.history;
    if (n >= h.length) return [...h];
    return h.slice(h.length - n);
  }

  // return the current open candle for interval (may be null)
  getCurrent(intervalMs) {
    const entry = this.data.get(intervalMs);
    return entry ? entry.current : null;
  }
}

// -----------------------------------------------------------------------------
// Velocity engine: computes all velocity-based signals according to the
// multi-layer architecture and alerts described in the specification.
// -----------------------------------------------------------------------------
class VelocityEngine {
  constructor() {}

  analyze(pair, tickBuffer) {
    const results = [];
    const baseline = CONFIG.velocity.baseline[pair] || 0.1;
    const windows = CONFIG.velocity.windows;
    const velData = windows
      .map((w) => tickBuffer.getVelocity(w.ms))
      .filter((v) => v && Number.isFinite(v.velocity));

    // map by window for easy lookup
    const byWindow = new Map();
    velData.forEach((d) => byWindow.set(d.windowMs, d));

    // Condition 1: Micro Burst
    const microData = byWindow.get(500);
    if (microData) {
      const mult = Math.abs(microData.velocity) / baseline;
      if (mult >= CONFIG.velocityMultipliers.microBurst && microData.acceleration >= CONFIG.accelerationThresholds.microBurst) {
        results.push({
          signal: "MICRO_BURST",
          pipsPerSecond: Math.abs(microData.velocity),
          accelerationRatio: microData.acceleration,
          windowDetected: "500ms",
          direction: microData.velocity > 0 ? "BUY" : "SELL",
          percentageEarly: CONFIG.earlyPercent[500]
        });
      }
    }

    // Condition 2: Velocity Explosion
    velData.forEach((d) => {
      const mult = Math.abs(d.velocity) / baseline;
      if (mult >= CONFIG.velocityMultipliers.velocityExplosion) {
        results.push({
          signal: "VELOCITY_EXPLOSION",
          pipsPerSecond: Math.abs(d.velocity),
          accelerationRatio: d.acceleration,
          windowDetected: `${d.windowMs}ms`,
          direction: d.velocity > 0 ? "BUY" : "SELL",
          percentageEarly: CONFIG.earlyPercent[d.windowMs] || 30
        });
      }
    });

    // Condition 3: Sustained Acceleration
    // require three consecutive windows all >= 4x baseline
    for (let i = 0; i < windows.length - 2; i++) {
      const w1 = windows[i];
      const w2 = windows[i + 1];
      const w3 = windows[i + 2];
      const d1 = byWindow.get(w1.ms);
      const d2 = byWindow.get(w2.ms);
      const d3 = byWindow.get(w3.ms);
      if (d1 && d2 && d3) {
        const m1 = Math.abs(d1.velocity) / baseline;
        const m2 = Math.abs(d2.velocity) / baseline;
        const m3 = Math.abs(d3.velocity) / baseline;
        if (m1 >= CONFIG.velocityMultipliers.sustainedSurge && m2 >= CONFIG.velocityMultipliers.sustainedSurge && m3 >= CONFIG.velocityMultipliers.sustainedSurge) {
          // highest confidence velocity signal
          const fastest = [d1, d2, d3].reduce((a, b) => (Math.abs(b.velocity) > Math.abs(a.velocity) ? b : a));
          results.push({
            signal: "SUSTAINED_SURGE",
            pipsPerSecond: Math.abs(fastest.velocity),
            accelerationRatio: fastest.acceleration,
            windowDetected: `${fastest.windowMs}ms`,
            direction: fastest.velocity > 0 ? "BUY" : "SELL",
            percentageEarly: CONFIG.earlyPercent[fastest.windowMs] || 30
          });
          break; // only one sustained signal per tick
        }
      }
    }

    // Condition 4: Acceleration Spike
    velData.forEach((d) => {
      if (d.acceleration >= CONFIG.accelerationThresholds.accelerationSpike) {
        results.push({
          signal: "ACCELERATION_SPIKE",
          pipsPerSecond: Math.abs(d.velocity),
          accelerationRatio: d.acceleration,
          windowDetected: `${d.windowMs}ms`,
          direction: d.velocity > 0 ? "BUY" : "SELL",
          percentageEarly: CONFIG.earlyPercent[d.windowMs] || 30
        });
      }
    });

    // select highest priority signal (order defined by spec: MICRO_BURST first,
    // then others).  We will return all results because the confluence engine may
    // need multiple, but for the basic alert we pick the first.
    return results;
  }
}

// -----------------------------------------------------------------------------
// Smart money/institutional detection engine.  Houses the candle builders and
// implements the eight signals described in the specification.  Results are
// returned as an array of simple objects {signal, details...}.
// -----------------------------------------------------------------------------
class SmartMoneyEngine {
  constructor() {
    this.candleBuilders = new Map(); // pair -> CandleBuilder
    // memory stores for order blocks, FVGs, swing points, etc.
    this.orderBlocks = new Map(); // pair -> [ {type, top, bottom} ]
    this.fvgs = new Map(); // pair -> [ {type, zone:{high,low}} ]
    this.swingPoints = new Map(); // pair -> [ {price, tsMs, highOrLow} ]
  }

  _ensureBuilder(pair) {
    let b = this.candleBuilders.get(pair);
    if (!b) {
      b = new CandleBuilder(pair);
      this.candleBuilders.set(pair, b);
    }
    return b;
  }

  processTick(pair, tick, tickBuffer = null) {
    const builder = this._ensureBuilder(pair);
    builder.addTick(tick);
    const signals = [];

    // we run detection on every tick but most signals only evaluate when a
    // relevant candle closes.  for simplicity we will just examine the history
    // during each call and fire if conditions are met (this is efficient as
    // history arrays are small).

    signals.push(...this._detectLiquiditySweep(pair));
    signals.push(...this._detectOrderBlock(pair, tick.price));
    signals.push(...this._detectFVG(pair));
    signals.push(...this._detectBOS(pair));
    signals.push(...this._detectCHOCH(pair));
    signals.push(...this._detectVolumeAnomaly(pair));
    signals.push(...this._detectSpreadSpike(pair, tickBuffer, tick));
    signals.push(...this._detectEqualHighsLows(pair));

    // cleanup memory stores based on current price movement
    this._cleanupMemory(pair, tick.price);

    return signals;
  }

  // 1. Liquidity sweep on 5m candles
  _detectLiquiditySweep(pair) {
    const ms = 5 * 60000;
    const candles = this._ensureBuilder(pair).getHistory(ms, 21);
    if (candles.length < 2) return [];
    const current = candles[candles.length - 1];
    const prev20 = candles.slice(0, candles.length - 1);
    // compute swing highs and lows from prev20 (simple extreme finder)
    const highs = prev20.map((c) => c.high);
    const lows = prev20.map((c) => c.low);
    const swingHigh = Math.max(...highs);
    const swingLow = Math.min(...lows);
    const results = [];
    // check for bullish sweep (wick below swingLow but close inside)
    if (current.low < swingLow - pipsToPrice(3, pair) && current.close > swingLow) {
      results.push({
        signal: "LIQUIDITY_SWEEP",
        type: "BULLISH",
        sweptPips: priceToPips(swingLow - current.low, pair),
        confidence: 50,
        details: "bullish sweep below swing low"
      });
    }
    // bearish sweep
    if (current.high > swingHigh + pipsToPrice(3, pair) && current.close < swingHigh) {
      results.push({
        signal: "LIQUIDITY_SWEEP",
        type: "BEARISH",
        sweptPips: priceToPips(current.high - swingHigh, pair),
        confidence: 50,
        details: "bearish sweep above swing high"
      });
    }
    return results;
  }

  // 2. Order block detection
  _detectOrderBlock(pair, currentPrice) {
    const ms = 5 * 60000;
    const candles = this._ensureBuilder(pair).getHistory(ms, 50);
    const results = [];
    if (candles.length < 2) return results;
    // find last impulse >15 pips
    for (let i = candles.length - 2; i >= 0; i--) {
      const cand = candles[i];
      const next = candles[i + 1];
      const diff = priceToPips(next.close - cand.close, pair);
      if (Math.abs(diff) >= 15) {
        // cand is order block
        const type = diff > 0 ? "BULLISH" : "BEARISH";
        const top = type === "BULLISH" ? cand.open : cand.close;
        const bottom = type === "BULLISH" ? cand.close : cand.open;
        // store for monitoring
        const list = this.orderBlocks.get(pair) || [];
        list.push({ type, top, bottom });
        this.orderBlocks.set(pair, list);
        break;
      }
    }
    // test returns to zone
    const list = this.orderBlocks.get(pair) || [];
    list.forEach((ob) => {
      if (currentPrice >= ob.bottom && currentPrice <= ob.top) {
        results.push({
          signal: "ORDER_BLOCK",
          type: ob.type,
          zone: { top: ob.top, bottom: ob.bottom }
        });
      }
    });
    return results;
  }

  // 3. Fair Value Gap
  _detectFVG(pair) {
    const ms = 5 * 60000;
    const candles = this._ensureBuilder(pair).getHistory(ms, 5);
    const results = [];
    if (candles.length < 3) return results;
    for (let i = 0; i < candles.length - 2; i++) {
      const c1 = candles[i];
      const c2 = candles[i + 1];
      const c3 = candles[i + 2];
      // bullish FVG
      if (c1.high < c3.low && priceToPips(c3.low - c1.high, pair) >= 8) {
        results.push({ signal: "FVG_FORMED", type: "BULLISH", zone: { high: c1.high, low: c3.low } });
      }
      // bearish FVG
      if (c1.low > c3.high && priceToPips(c1.low - c3.high, pair) >= 8) {
        results.push({ signal: "FVG_FORMED", type: "BEARISH", zone: { high: c3.high, low: c1.low } });
      }
    }
    return results;
  }

  // 4. Break of Structure using 15m candles
  _detectBOS(pair) {
    const ms = 15 * 60000;
    const candles = this._ensureBuilder(pair).getHistory(ms, 50);
    const results = [];
    if (candles.length < 3) return results;
    // simple swing high/low approach: last significant swing (extreme)
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const lastHigh = Math.max(...highs.slice(0, -1));
    const lastLow = Math.min(...lows.slice(0, -1));
    const last = candles[candles.length - 1];
    if (last.close > lastHigh + pipsToPrice(10, pair)) {
      results.push({ signal: "BOS", type: "BULLISH", brokenBy: priceToPips(last.close - lastHigh, pair) });
    }
    if (last.close < lastLow - pipsToPrice(10, pair)) {
      results.push({ signal: "BOS", type: "BEARISH", brokenBy: priceToPips(lastLow - last.close, pair) });
    }
    return results;
  }

  // 5. Change of character
  _detectCHOCH(pair) {
    const ms = 15 * 60000;
    const candles = this._ensureBuilder(pair).getHistory(ms, 50);
    const results = [];
    if (candles.length < 3) return results;
    // detect recent swing direction and simple break of lower high or higher low
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const prevHigh = Math.max(...highs.slice(0, -2));
    const prevLow = Math.min(...lows.slice(0, -2));
    const last = candles[candles.length - 1];
    if (last.close > prevHigh) {
      results.push({ signal: "CHOCH", type: "BULLISH" });
    }
    if (last.close < prevLow) {
      results.push({ signal: "CHOCH", type: "BEARISH" });
    }
    return results;
  }

  // 6. Volume profile anomaly
  _detectVolumeAnomaly(pair) {
    const ms = 5 * 60000; // use 5m for volume patterns
    const candles = this._ensureBuilder(pair).getHistory(ms, 10);
    const results = [];
    if (candles.length < 3) return results;
    const volumes = candles.map((c) => c.volume || 0);
    const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    if (last.volume >= avgVol * 3) {
      const priceMove = Math.abs(priceToPips(last.close - last.open, pair));
      if (priceMove < 3) {
        results.push({ signal: "VOLUME_ABSORPTION", multiplier: last.volume / avgVol });
      } else if (priceMove > 20) {
        results.push({ signal: "VOLUME_PUSH", multiplier: last.volume / avgVol });
      }
    }
    // exhaustion detection: three candles of declining volume while price moves
    if (candles.length >= 4) {
      const last3 = candles.slice(-3);
      if (
        last3[0].volume > last3[1].volume &&
        last3[1].volume > last3[2].volume &&
        ((last3[0].close < last3[2].close && last3[0].open < last3[0].close) ||
          (last3[0].close > last3[2].close && last3[0].open > last3[0].close))
      ) {
        results.push({ signal: "VOLUME_EXHAUSTION" });
      }
    }
    return results;
  }

  // 7. Spread spike detection using tick buffer contents
  _detectSpreadSpike(pair, tickBuffer, tick) {
    const results = [];
    if (!tickBuffer || !tick) return results;
    const avgSpread = tickBuffer.averageSpread();
    if (avgSpread == null) return results;
    const curSpread = tick.ask != null && tick.bid != null ? tick.ask - tick.bid : null;
    if (curSpread == null) return results;
    if (avgSpread > 0 && curSpread >= avgSpread * 3) {
      results.push({
        signal: "SPREAD_SPIKE",
        multiplier: curSpread / avgSpread,
        details: { current: curSpread, average: avgSpread }
      });
    }
    // additional check for spike then quick tighten could be implemented by
    // storing state, but for now we only alert on widening.
    return results;
  }

  // 8. Equal highs/lows detection
  _detectEqualHighsLows(pair) {
    const ms = 5 * 60000;
    const candles = this._ensureBuilder(pair).getHistory(ms, 50);
    const results = [];
    if (candles.length < 3) return results;
    const swings = [];
    // simple swing detection: local high/low
    for (let i = 1; i < candles.length - 1; i++) {
      if (candles[i].high >= candles[i - 1].high && candles[i].high >= candles[i + 1].high) {
        swings.push({ price: candles[i].high, type: "high" });
      }
      if (candles[i].low <= candles[i - 1].low && candles[i].low <= candles[i + 1].low) {
        swings.push({ price: candles[i].low, type: "low" });
      }
    }
    for (let i = 0; i < swings.length; i++) {
      for (let j = i + 1; j < swings.length; j++) {
        if (
          swings[i].type === swings[j].type &&
          Math.abs(priceToPips(swings[i].price - swings[j].price, pair)) <= 3
        ) {
          results.push({ signal: "EQH_EQL", type: swings[i].type, price: swings[i].price });
        }
      }
    }
    return results;
  }

  // after each tick we may need to purge order blocks or FVGs that have been
  // consumed by price movement to avoid unbounded growth.
  _cleanupMemory(pair, currentPrice) {
    // order blocks: remove if price closes beyond zone by 1 pip
    const obs = this.orderBlocks.get(pair) || [];
    const pip = getPipSize(pair);
    const remaining = obs.filter((ob) => {
      if (ob.type === "BULLISH") {
        return currentPrice <= ob.top + pip;
      } else {
        return currentPrice >= ob.bottom - pip;
      }
    });
    this.orderBlocks.set(pair, remaining);

    // FVGs: remove if price enters the gap zone
    const fvgs = this.fvgs.get(pair) || [];
    const fvRemain = fvgs.filter((f) => {
      const { low, high } = f.zone;
      return !(currentPrice >= low && currentPrice <= high);
    });
    this.fvgs.set(pair, fvRemain);
  }
}

// -----------------------------------------------------------------------------
// Confluence engine: combine velocity and institutional signals to compute a
// confidence score and final alert packet.  Also tracks previous alert direction
// for same-direction bonus.
// -----------------------------------------------------------------------------
class ConfluenceEngine {
  constructor() {
    this.lastDirection = new Map(); // pair -> BUY/SELL
  }

  scoreSignals(pair, velocityAlerts, instSignals) {
    let score = 0;
    const factors = [];
    if (velocityAlerts && velocityAlerts.length) {
      score += CONFIG.confluenceWeights.velocity;
      factors.push("velocity");
    }
    let primaryInst = null;
    if (instSignals && instSignals.length) {
      instSignals.forEach((s) => {
        const weight = CONFIG.confluenceWeights[s.signal.toLowerCase()] || 0;
        score += weight;
        factors.push(s.signal);
        if (!primaryInst || weight > (CONFIG.confluenceWeights[primaryInst.signal.toLowerCase()] || 0)) {
          primaryInst = s;
        }
      });
    }
    const lastDir = this.lastDirection.get(pair);
    const dir = velocityAlerts.length ? velocityAlerts[0].direction : primaryInst?.type;
    if (dir && dir === lastDir) {
      score += CONFIG.confluenceWeights.sameDirection;
      factors.push("sameDirection");
    }
    this.lastDirection.set(pair, dir);
    // determine label
    const labelObj = CONFIG.confidenceLabels.find((c) => score >= c.min) || { label: "LOW" };
    return { score, label: labelObj.label, primaryInst, direction: dir, factors };
  }
}

// -----------------------------------------------------------------------------
// Alert manager: handles cooldowns and also assembles final alert object with
// entry/SL/TP, notification formatting, and meta information.
// -----------------------------------------------------------------------------
class AlertManager {
  constructor() {
    this.lastAlert = new Map(); // pair|signal -> timestamp
    this.alertsToday = new Map(); // pair -> count
  }

  canSend(pair, signal) {
    const now = nowMs();
    const key = `${pair}|${signal}`;
    const last = this.lastAlert.get(key) || 0;
    if (signal === "CRASH" && CONFIG.cooldowns.crashBypass) {
      return true;
    }
    const cooldown = signal === "MICRO_BURST" ? CONFIG.cooldowns.micro : CONFIG.cooldowns.base;
    if (now - last < cooldown) return false;
    this.lastAlert.set(key, now);
    return true;
  }

  buildAlert(pair, price, bid, ask, velocityAlert, instSignals, confluence) {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const detectionLatencyMs = nowMs() - price.tsMs;
    // pick primary velocity signal if exists otherwise derive direction from inst
    const velocity = velocityAlert || null;
    const direction = confluence.direction || "BUY";
    const strength = velocity ? this._classifyStrength(velocity.pipsPerSecond / (CONFIG.velocity.baseline[pair] || 0.1)) : "EARLY";
    const levels = this._calcLevels(price.price, direction, strength, pair);
    const confidence = {
      score: confluence.score,
      label: confluence.label,
      factors: confluence.factors
    };
    const notification = this._buildNotification(pair, velocity, direction, price.price, levels, confluence.score);
    const meta = {
      alertsToday: this.alertsToday.get(pair) || 0,
      lastAlertForPair: timestamp,
      marketSession: null,
      volatilityLevel: null
    };

    // increment daily count
    this.alertsToday.set(pair, (this.alertsToday.get(pair) || 0) + 1);

    return {
      id,
      pair,
      timestamp,
      detectionLatencyMs,
      velocity: velocity || {},
      institutional: {
        signals: instSignals,
        primarySignal: confluence.primaryInst ? confluence.primaryInst.signal : null,
        confluence: confluence.score
      },
      direction,
      currentPrice: price.price,
      bid: bid || null,
      ask: ask || null,
      spread: bid != null && ask != null ? ask - bid : null,
      levels,
      confidence,
      notification,
      meta
    };
  }

  _classifyStrength(mult) {
    if (mult >= CONFIG.strengthMultipliers.CRASH) return "CRASH";
    if (mult >= CONFIG.strengthMultipliers.EXPLOSIVE) return "EXPLOSIVE";
    if (mult >= CONFIG.strengthMultipliers.STRONG) return "STRONG";
    return "EARLY";
  }

  _calcLevels(price, direction, strength, pair) {
    const base = CONFIG.entrySLTP[strength] || CONFIG.entrySLTP.EARLY;
    const slPips = base.sl;
    const tpPips = base.tp;
    const entry = price;
    const sl = direction === "BUY" ? price - pipsToPrice(slPips, pair) : price + pipsToPrice(slPips, pair);
    const tp = direction === "BUY" ? price + pipsToPrice(tpPips, pair) : price - pipsToPrice(tpPips, pair);
    const riskReward = tpPips / slPips;
    return { entry, stopLoss: sl, takeProfit: tp, slPips, tpPips, riskReward };
  }

  _buildNotification(pair, velocity, direction, price, levels, score) {
    const signal = velocity ? velocity.signal : "CONFLUENCE";
    const vps = velocity ? velocity.pipsPerSecond.toFixed(2) : "N/A";
    const mult = velocity ? ((velocity.pipsPerSecond / (CONFIG.velocity.baseline[pair] || 0.1)).toFixed(2)) : "N/A";
    const window = velocity ? velocity.windowDetected : "-";
    const earlyPct = velocity ? velocity.percentageEarly : "-";
    const title = `⚡ ${pair} — ${signal} ${direction} — ACT NOW`;
    const body = `${pair} moving ${vps} pips/sec — ${mult}x faster than normal. ${direction} opportunity. Entry: ${price.toFixed(decimalsForPair(pair))} SL: ${levels.stopLoss.toFixed(decimalsForPair(pair))} TP: ${levels.takeProfit.toFixed(decimalsForPair(pair))}. Detected in ${window} window. Move ${earlyPct}% likely still early.`;
    const priority = score >= 100 ? "CRITICAL" : score >= 80 ? "HIGH" : score >= 60 ? "MEDIUM" : score >= 40 ? "LOW" : "LOW";
    return {
      title,
      body,
      priority,
      sound: priority !== "LOW",
      data: {} // deep link payload to be filled by calling code if needed
    };
  }
}

// -----------------------------------------------------------------------------
// Top-level orchestrator class: wires together the buffers/engines and exposes
// `processTick` and a simple test mode generator.
// -----------------------------------------------------------------------------
class ForexFutureEngine {
  constructor() {
    this.tickBuffers = new Map();
    this.velocityEngine = new VelocityEngine();
    this.smartMoneyEngine = new SmartMoneyEngine();
    this.confluenceEngine = new ConfluenceEngine();
    this.alertManager = new AlertManager();
    // allow user to set a callback
    this.onAlert = null;

    // periodic garbage collection to prune old ticks / memory stores
    this.gcTimer = setInterval(() => this._garbageCollect(), CONFIG.cleanupIntervalMs);
  }

  _ensureBuffer(pair) {
    let buf = this.tickBuffers.get(pair);
    if (!buf) {
      buf = new TickBuffer(pair);
      this.tickBuffers.set(pair, buf);
    }
    return buf;
  }

  processTick(pair, price, priceType, tsMs, extra = {}) {
    const buf = this._ensureBuffer(pair);
    const tick = { tsMs, price, priceType, bid: extra.bid, ask: extra.ask, volume: extra.volume };
    buf.addTick(tick);
    // update candles and institutional engine (provide buffer for spread spike)
    const instSignals = this.smartMoneyEngine.processTick(pair, tick, buf);
    // run velocity detection
    const velAlerts = this.velocityEngine.analyze(pair, buf);

    // simple early exit if no velocity and no institutional signals
    if ((!velAlerts || velAlerts.length === 0) && instSignals.length === 0) {
      return [];
    }

    // compute confluence score
    const confluence = this.confluenceEngine.scoreSignals(pair, velAlerts || [], instSignals);
    // pick primary velocity alert (highest priority) if any
    const primaryVel = velAlerts.length ? velAlerts[0] : null;
    // check cooldowns for each velocity signal or institutional primary
    const alertsToEmit = [];
    if (primaryVel && this.alertManager.canSend(pair, primaryVel.signal)) {
      const alert = this.alertManager.buildAlert(pair, tick, extra.bid, extra.ask, primaryVel, instSignals, confluence);
      alertsToEmit.push(alert);
      if (this.onAlert) this.onAlert(alert);
    } else if (!primaryVel && instSignals.length > 0) {
      // fire pure institutional alert if cooldown permits on highest weighting signal
      const primaryInst = confluence.primaryInst;
      if (primaryInst && this.alertManager.canSend(pair, primaryInst.signal)) {
        const fakeVel = null;
        const alert = this.alertManager.buildAlert(pair, tick, extra.bid, extra.ask, fakeVel, instSignals, confluence);
        alertsToEmit.push(alert);
        if (this.onAlert) this.onAlert(alert);
      }
    }
    return alertsToEmit;
  }

  // prune old data from buffers to keep memory under control
  _garbageCollect() {
    const cutoff = nowMs() - 60 * 60 * 1000; // keep last 1h of ticks
    this.tickBuffers.forEach((buf) => {
      while (buf.buffer.length && buf.buffer[0].tsMs < cutoff) {
        buf.buffer.shift();
      }
    });
    // optionally clean candle builders or other state if idle
  }

  // synthetic tick generator for test mode – returns an array of alerts that were
  // produced while walking through the synthetic data set.  The data exercises
  // most detection paths.
  runSyntheticTest() {
    const pair = "EURUSD";
    const now = nowMs();
    const alerts = [];
    // micro burst scenario: generate a rapid price jump in <500ms
    const basePrice = 1.1000;
    for (let i = 0; i < 10; i++) {
      const ts = now + i * 50;
      const price = basePrice + (i < 5 ? 0 : 0.001 * (i - 4));
      alerts.push(...this.processTick(pair, price, "last", ts));
    }
    // slow move for institutional patterns: create 5m candles
    let ts = now + 5000;
    for (let i = 0; i < 25; i++) {
      const price = basePrice + i * 0.0005;
      alerts.push(...this.processTick(pair, price, "last", ts));
      ts += 30000; // tick every 30s
    }
    return alerts;
  }
}

export {
  CONFIG,
  TickBuffer,
  CandleBuilder,
  VelocityEngine,
  SmartMoneyEngine,
  ConfluenceEngine,
  AlertManager,
  ForexFutureEngine
};
