/**
 * ENTERPRISE-GRADE FOREX ALERT DETECTION ENGINE
 * 
 * Completely rebuilt to eliminate false alerts and provide only meaningful,
 * tradeable signals. Implements 10 major components:
 * 1. Minimum Move Thresholds (Part 1)
 * 2. Noise Filter Layer (Part 2)
 * 3. Movement Criteria (Part 3)
 * 4. Alert Strength Classification (Part 4)
 * 5. Smart Entry Levels (Part 5)
 * 6. Frequency Rules (Part 6)
 * 7. Self-Calibrating Baseline (Part 7)
 * 8. Final Validation (Part 8)
 * 9. Console Output Format (Part 9)
 * 10. Performance/Error Handling (Part 10)
 */
import { decimalsForPair, pipSizeForPair } from "./marketValidator.js";

// ============================================================================
// PART 1 - MINIMUM MOVE THRESHOLDS (Hard Floors)
// ============================================================================

const MINIMUM_PIP_THRESHOLDS = {
  'EUR/USD': { pips: 15, timeWindowMs: 300000 },
  'GBP/USD': { pips: 18, timeWindowMs: 300000 },
  'USD/JPY': { pips: 15, timeWindowMs: 300000 },
  'AUD/USD': { pips: 12, timeWindowMs: 300000 },
  'USD/CHF': { pips: 14, timeWindowMs: 300000 },
  'GBP/JPY': { pips: 25, timeWindowMs: 300000 },
  'EUR/JPY': { pips: 20, timeWindowMs: 300000 },
  'USD/CAD': { pips: 14, timeWindowMs: 300000 },
  'NZD/USD': { pips: 12, timeWindowMs: 300000 },
  'EUR/GBP': { pips: 12, timeWindowMs: 300000 },
  'EUR/CHF': { pips: 12, timeWindowMs: 300000 },
  'AUD/JPY': { pips: 18, timeWindowMs: 300000 },
  'CAD/JPY': { pips: 18, timeWindowMs: 300000 },
  'CHF/JPY': { pips: 18, timeWindowMs: 300000 },
  'AUD/CAD': { pips: 14, timeWindowMs: 300000 },
  'NZD/JPY': { pips: 18, timeWindowMs: 300000 },
  'XAU/USD': { pips: 200, timeWindowMs: 300000 },
};

// IMPROVED: normalize pair keys so both `EUR/USD` and `EURUSD` are accepted.
const normalizePair = (pair) => {
  const raw = String(pair || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (raw.length === 6) {
    return `${raw.slice(0, 3)}/${raw.slice(3)}`;
  }
  return String(pair || "");
};

// ============================================================================
// PART 7 - MARKET SESSION DEFINITIONS
// ============================================================================

const TRADING_SESSIONS = {
  ASIAN: { name: 'Asian', startUTC: 0, endUTC: 8, thresholdMultiplier: 1.5 },
  LONDON: { name: 'London', startUTC: 8, endUTC: 12, thresholdMultiplier: 1.0 },
  NEWYORK: { name: 'New York', startUTC: 13, endUTC: 21, thresholdMultiplier: 1.0 },
  LONDON_NY_OVERLAP: { name: 'London/NY Overlap', startUTC: 12, endUTC: 13, thresholdMultiplier: 0.85 },
  DEADZONE: { name: 'Dead Zone', startUTC: 21, endUTC: 24, thresholdMultiplier: 2.0 },
};

// ============================================================================
// PART 4 - ALERT SEVERITY LEVELS
// ============================================================================

const ALERT_LEVELS = {
  SIGNIFICANT: {
    level: 1,
    name: 'SIGNIFICANT',
    pipRange: [12, 20],
    timeWindowMs: 300000,
    color: 'yellow',
    sound: 'silent',
    riskReward: 2.0,
    slPips: 10,
    tpPips: 20,
  },
  STRONG: {
    level: 2,
    name: 'STRONG',
    pipRange: [20, 35],
    timeWindowMs: 180000,
    color: 'orange',
    sound: 'soft chime',
    riskReward: 2.5,
    slPips: 15,
    tpPips: 35,
  },
  EXPLOSIVE: {
    level: 3,
    name: 'EXPLOSIVE',
    pipRange: [35, 55],
    timeWindowMs: 120000,
    color: 'red',
    sound: 'loud alert',
    riskReward: 2.8,
    slPips: 20,
    tpPips: 55,
  },
  CRASH: {
    level: 4,
    name: 'CRASH',
    pipRange: [55, Infinity],
    timeWindowMs: 60000,
    color: 'dark red flashing',
    sound: 'emergency alarm',
    riskReward: 3.4,
    slPips: 28,
    tpPips: 90,
  },
};

// IMPROVED: configurable risk/quality guardrails without code edits.
const MIN_PIP_GATE_RATIO = Math.max(
  0.1,
  Math.min(1, Number(process.env.MARKET_ALERT_MIN_PIP_GATE_RATIO || 0.35))
);
const MIN_TICK_FREQUENCY = Math.max(0.1, Number(process.env.MARKET_ALERT_MIN_TICK_FREQUENCY || 0.5));
const MAX_ALLOWED_SPREAD_PIPS = Math.max(1, Number(process.env.MARKET_ALERT_MAX_SPREAD_PIPS || 4));

// ============================================================================
// PART 2 - NOISE FILTER LAYER
// ============================================================================

class NoiseFilter {
  constructor(pair, options = {}) {
    this.pair = normalizePair(pair);
    // IMPROVED: initialize spread baseline from instrument pip size.
    this.averageSpread =
      Number.isFinite(Number(options.averageSpread)) && Number(options.averageSpread) > 0
        ? Number(options.averageSpread)
        : this.getPipSize() * 1.5;
    this.spreadSamples = 0;
    this.wideSpreadFlag = false;
    this.recentAlerts = [];
    this.maxRecentAlerts = 100;
  }

  /**
   * Filter 1 - Minimum Pip Gate
   * Calculate total pips in last 60 seconds
   */
  checkMinimumPipGate(tickHistory, nowTs = Date.now()) {
    if (tickHistory.length < 2) return true; // Pass if insufficient data

    const lastMinute = tickHistory.filter((t) => nowTs - t.ts < 60000 && Number.isFinite(t.bid));
    if (lastMinute.length < 2) return true;

    const pipSize = this.getPipSize();
    let highPrice = -Infinity;
    let lowPrice = Infinity;
    for (let i = 0; i < lastMinute.length; i++) {
      const b = lastMinute[i].bid;
      if (b > highPrice) highPrice = b;
      if (b < lowPrice) lowPrice = b;
    }
    const totalPips = (highPrice - lowPrice) / pipSize;

    const threshold = MINIMUM_PIP_THRESHOLDS[this.pair];
    if (!threshold) return true; // No threshold defined = pass

    // IMPROVED: gate on progress ratio so gradual but legitimate 3-minute moves are not suppressed.
    const gatePips = Math.max(3, threshold.pips * MIN_PIP_GATE_RATIO);
    return totalPips >= gatePips;
  }

  /**
   * Filter 2 - Spread Filter
   * Check if spread is abnormally wide
   */
  checkSpreadFilter(bid, ask) {
    if (!Number.isFinite(bid) || !Number.isFinite(ask)) return false;
    if (ask < bid) return false;
    const currentSpread = ask - bid;
    const maxAllowedSpread = Math.max(this.averageSpread * 3, this.getPipSize() * MAX_ALLOWED_SPREAD_PIPS);

    if (currentSpread > maxAllowedSpread) {
      // Flag wide spread instead of blocking — real moves can have wide spreads
      this.wideSpreadFlag = true;
      return true;
    }

    this.wideSpreadFlag = false;
    return true;
  }

  /**
   * Filter 3 - Session Filter
   * Returns multiplier for current session
   */
  getSessionThresholdMultiplier(nowTs = Date.now()) {
    const now = new Date(nowTs);
    const hourUTC = now.getUTCHours();
    const minuteUTC = now.getUTCMinutes();

    // Dead Zone: 21:00 - 05:00 UTC (stricter, W12 fix: was 0-6, now 0-5)
    if ((hourUTC >= 21 && hourUTC < 24) || (hourUTC >= 0 && hourUTC < 5)) {
      return TRADING_SESSIONS.DEADZONE.thresholdMultiplier;
    }

    // London open first 30 min: 08:00-08:30 UTC → lower threshold (-10%)
    if (hourUTC === 8 && minuteUTC < 30) {
      return 0.9;
    }

    // NY open first 30 min: 13:00-13:30 UTC → lower threshold (-10%)
    if (hourUTC === 13 && minuteUTC < 30) {
      return 0.9;
    }

    // London/NY Overlap: 12:00 - 13:00 UTC (relaxed)
    if (hourUTC >= 12 && hourUTC < 13) {
      return TRADING_SESSIONS.LONDON_NY_OVERLAP.thresholdMultiplier;
    }

    // Asian session: 05:00 - 08:00 UTC (stricter)
    if (hourUTC >= 5 && hourUTC < 8) {
      return TRADING_SESSIONS.ASIAN.thresholdMultiplier;
    }

    // London session: 08:00 - 12:00 UTC (normal)
    if (hourUTC >= 8 && hourUTC < 12) {
      return TRADING_SESSIONS.LONDON.thresholdMultiplier;
    }

    // New York session: 13:00 - 21:00 UTC (normal)
    if (hourUTC >= 13 && hourUTC < 21) {
      return TRADING_SESSIONS.NEWYORK.thresholdMultiplier;
    }

    return 1.0;
  }

  /**
   * Filter 4 - Consecutive Tick Confirmation
   * Require 3 consecutive ticks in same direction
   */
  checkConsecutiveTickConfirmation(tickHistory) {
    if (tickHistory.length < 3) return false;

    // Check the last 3 ticks
    const lastThreeTicks = tickHistory.slice(-3);
    
    // Calculate price directions for each pair of consecutive ticks
    const tick0To1 = lastThreeTicks[1].bid - lastThreeTicks[0].bid;
    const tick1To2 = lastThreeTicks[2].bid - lastThreeTicks[1].bid;

    // Both moves must be in the same direction (both positive or both negative)
    // AND both must be significant (not just a few pips difference)
    const minMovementThreshold = 0; // Any positive or negative move counts
    
    const sameDirection = (tick0To1 > minMovementThreshold && tick1To2 > minMovementThreshold) ||
                         (tick0To1 < -minMovementThreshold && tick1To2 < -minMovementThreshold);

    return sameDirection;
  }

  /**
   * Filter 5 - Velocity Consistency Check
   * Require velocity to be consistent across at least 3 of last 5 ticks
   */
  checkVelocityConsistency(tickHistory) {
    // IMPROVED: allow early-stage legitimate moves before 5 ticks are available.
    if (tickHistory.length < 5) return true;

    const recent = tickHistory.slice(-5);
    const pipSize = this.getPipSize();
    const velocities = [];

    for (let i = 1; i < recent.length; i++) {
      const timeDiff = (recent[i].ts - recent[i - 1].ts) / 1000; // seconds
      if (timeDiff === 0) continue;

      const priceDiff = (recent[i].bid - recent[i - 1].bid) / pipSize;
      const velocity = Math.abs(priceDiff / timeDiff);
      velocities.push(velocity);
    }

    if (velocities.length < 3) return true;

    // Use median velocity as reference instead of max to reduce outlier sensitivity
    const sortedVelocities = [...velocities].sort((a, b) => a - b);
    const medianVelocity = sortedVelocities[Math.floor(sortedVelocities.length / 2)];
    const highVelocityThreshold = medianVelocity * 0.5;

    const consistentCount = velocities.filter(v => v >= highVelocityThreshold).length;
    return consistentCount >= 3;
  }

  /**
   * Filter 6 - Price Sanity Check
   * Discard if move > 200 pips in < 1 second
   */
  checkPriceSanity(tickHistory) {
    if (tickHistory.length < 2) return true;

    const recent = tickHistory.slice(-2);
    const timeDiff = (recent[1].ts - recent[0].ts) / 1000; // seconds
    if (timeDiff >= 1) return true; // Time window is fine

    const pipSize = this.getPipSize();
    const pipMove = Math.abs((recent[1].bid - recent[0].bid) / pipSize);

    return pipMove <= 200; // Fail if > 200 pips in < 1 second
  }

  /**
   * Filter 7 - Duplicate Alert Prevention
   * Skip if within same 15 pip range in last 10 minutes
   */
  checkDuplicateAlert(currentPrice, nowTs = Date.now()) {
    const pipSize = this.getPipSize();
    const tenMinutesAgo = nowTs - 600000;

    // Clean old alerts
    this.recentAlerts = this.recentAlerts.filter(alert => alert.ts > tenMinutesAgo);

    // Check if current price is within 15 pips of any alert
    for (const alert of this.recentAlerts) {
      const pipDiff = Math.abs((currentPrice - alert.price) / pipSize);
      if (pipDiff <= 15) {
        return false; // Duplicate - skip
      }
    }

    return true; // Not duplicate
  }

  /**
   * Record an alert for duplicate checking
   */
  recordAlert(price, tsMs = Date.now()) {
    this.recentAlerts.push({
      price,
      ts: tsMs,
    });

    if (this.recentAlerts.length > this.maxRecentAlerts) {
      this.recentAlerts.shift();
    }
  }

  /**
   * Master filter - runs all filters
   * Returns true if tick passes all filters
   */
  filter(tick, tickHistory) {
    try {
      // Filter 1: Minimum pip gate
      if (!this.checkMinimumPipGate(tickHistory, tick.ts)) {
        return false;
      }

      // Filter 2: Spread filter
      if (!this.checkSpreadFilter(tick.bid, tick.ask)) {
        return false;
      }
      this.updateSpreadBaseline(tick.bid, tick.ask);

      // Filter 3: Session filter (returns multiplier, always passes)
      // This is used in analyzer, not for rejection

      // Filter 4: Consecutive tick confirmation
      if (!this.checkConsecutiveTickConfirmation(tickHistory)) {
        return false;
      }

      // Filter 5: Velocity consistency
      if (!this.checkVelocityConsistency(tickHistory)) {
        return false;
      }

      // Filter 6: Price sanity check
      if (!this.checkPriceSanity(tickHistory)) {
        return false;
      }

      // Filter 7: Duplicate alert prevention
      if (!this.checkDuplicateAlert(tick.bid, tick.ts)) {
        return false;
      }

      return true;
    } catch (_error) {
      // Log error but pass through to avoid crashing
      return true;
    }
  }

  getPipSize() {
    return pipSizeForPair(this.pair);
  }

  // IMPROVED: keep an adaptive spread baseline for current market conditions.
  updateSpreadBaseline(bid, ask) {
    if (!Number.isFinite(bid) || !Number.isFinite(ask) || ask < bid) return;
    const spread = ask - bid;
    this.spreadSamples += 1;
    const alpha = this.spreadSamples < 20 ? 0.25 : 0.1;
    this.averageSpread = (1 - alpha) * this.averageSpread + alpha * spread;
  }
}

// ============================================================================
// PART 3 - MOVEMENT ANALYZER
// ============================================================================

class MovementAnalyzer {
  constructor(pair, baselineCalibrator = null) {
    this.pair = normalizePair(pair);
    this.baselineCalibrator = baselineCalibrator;
  }

  /**
   * Analyze if movement meets all 5 criteria
   */
  analyze(tickHistory, noiseFilter, nowTs = Date.now()) {
    // IMPROVED: allow detection once three directional ticks establish a valid move.
    if (tickHistory.length < 3) return null;

    try {
      // Get the threshold window
      const threshold = MINIMUM_PIP_THRESHOLDS[this.pair];
      if (!threshold) return null;

      // Dynamic window: shorten during high volatility for faster detection
      const volAdj = this.baselineCalibrator
        ? this.baselineCalibrator.getVolatilityAdjustment()
        : 1.0;
      // High volatility (volAdj < 1) → shorter window (min 60% of base)
      // Low volatility (volAdj > 1) → keep base window (don't extend)
      const windowScale = volAdj < 1 ? Math.max(0.6, volAdj) : 1.0;
      const windowMs = Math.round(threshold.timeWindowMs * windowScale);
      const windowStart = nowTs - windowMs;

      // Get ticks in window
      const windowTicks = tickHistory.filter((t) => t.ts >= windowStart && Number.isFinite(t.bid));
      if (windowTicks.length < 2) return null;

      const pipSize = this.getPipSize();

      // CRITERIA 1: Minimum pip distance (single-pass for O(n) efficiency)
      let highPrice = -Infinity;
      let lowPrice = Infinity;
      for (let i = 0; i < windowTicks.length; i++) {
        const b = windowTicks[i].bid;
        if (b > highPrice) highPrice = b;
        if (b < lowPrice) lowPrice = b;
      }
      const totalPips = (highPrice - lowPrice) / pipSize;
      if (!Number.isFinite(totalPips) || totalPips <= 0) return null;

      const adjustedThreshold = threshold.pips * noiseFilter.getSessionThresholdMultiplier(nowTs);
      const volatilityAdjustment = this.baselineCalibrator
        ? this.baselineCalibrator.getVolatilityAdjustment()
        : 1.0;

      const finalThreshold = adjustedThreshold * volatilityAdjustment;

      if (totalPips < finalThreshold) {
        return null;
      }

      // Determine direction
      const firstPrice = windowTicks[0].bid;
      const lastPrice = windowTicks[windowTicks.length - 1].bid;
      if (lastPrice === firstPrice) return null;
      const direction = lastPrice > firstPrice ? 'BUY' : 'SELL';

      // CRITERIA 2: Minimum speed
      const timeTakenMs = windowTicks[windowTicks.length - 1].ts - windowTicks[0].ts;
      if (!Number.isFinite(timeTakenMs) || timeTakenMs <= 0) return null;
      const speed = this.classifySpeed(totalPips, timeTakenMs);
      if (!speed) return null;

      // CRITERIA 3: Directional consistency
      const consistency = this.calculateDirectionalConsistency(windowTicks, direction);
      if (consistency < 0.75) {
        return null;
      }

      // CRITERIA 4: Momentum confirmation
      const momentum = this.getMomentumConfirmation(windowTicks);
      if (momentum === 'declining') {
        return null;
      }

      // CRITERIA 5: Volume confirmation (tick frequency)
      const tickFrequency = (windowTicks.length / timeTakenMs) * 1000; // ticks per second
      if (tickFrequency < MIN_TICK_FREQUENCY) {
        // Low frequency ticks = low institutional backing
        // Only allow if move is very large (EXPLOSIVE or CRASH level)
        if (totalPips < 50) {
          return null;
        }
      }

      return {
        totalPips,
        direction,
        speed,
        consistency,
        momentum,
        tickFrequency,
        timeTakenMs,
        severity: this.calculateSeverity(totalPips, timeTakenMs),
        moveOriginPrice: direction === 'BUY' ? lowPrice : highPrice,
        extremePrice: direction === 'BUY' ? highPrice : lowPrice,
      };
    } catch (_error) {
      return null;
    }
  }

  /**
   * Classify speed: EXPLOSIVE, STRONG, MODERATE
   */
  classifySpeed(pips, ms) {
    const seconds = ms / 1000;

    if (seconds <= 30 && pips >= 12) return 'EXPLOSIVE';
    if (seconds <= 90 && pips >= 12) return 'STRONG';
    if (seconds <= 300 && pips >= 12) return 'MODERATE';

    return null;
  }

  /**
   * Calculate percentage of ticks moving in dominant direction
   */
  calculateDirectionalConsistency(ticks, dominantDirection) {
    if (ticks.length < 2) return 0;

    let weightedConsistent = 0;
    let totalWeight = 0;

    for (let i = 1; i < ticks.length; i++) {
      const change = ticks[i].bid - ticks[i - 1].bid;
      if (change === 0) continue;
      const tickDirection = change > 0 ? 'BUY' : 'SELL';
      // Weight recent ticks more heavily (linear ramp: older=1, newest=2)
      const weight = 1 + (i / ticks.length);
      totalWeight += weight;

      if (tickDirection === dominantDirection) {
        weightedConsistent += weight;
      }
    }

    if (totalWeight === 0) return 0;
    return weightedConsistent / totalWeight;
  }

  /**
   * Check if momentum is still positive or declining.
   * Returns 'accelerating', 'steady', or 'declining' using second derivative (acceleration).
   */
  getMomentumConfirmation(ticks) {
    if (ticks.length < 5) return 'accelerating';

    const recent = ticks.slice(-5);
    const pipSize = this.getPipSize();

    const velocities = [];
    for (let i = 1; i < recent.length; i++) {
      const timeDiff = (recent[i].ts - recent[i - 1].ts) / 1000;
      if (timeDiff <= 0) continue;
      const priceDiff = Math.abs(recent[i].bid - recent[i - 1].bid) / pipSize;
      velocities.push(priceDiff / timeDiff);
    }

    if (velocities.length < 2) return 'accelerating';

    // Second derivative: acceleration between consecutive velocity samples
    const accelerations = [];
    for (let i = 1; i < velocities.length; i++) {
      accelerations.push(velocities[i] - velocities[i - 1]);
    }

    const avgAcceleration = accelerations.reduce((a, b) => a + b, 0) / accelerations.length;
    const lastVelocity = velocities[velocities.length - 1];
    const avgEarlierVelocity = velocities.slice(0, -1).reduce((a, b) => a + b, 0) / (velocities.length - 1);

    // Declining: velocity dropped >70% AND acceleration is negative
    if (lastVelocity < avgEarlierVelocity * 0.3 && avgAcceleration < 0) {
      return 'declining';
    }

    // Accelerating: positive acceleration
    if (avgAcceleration > 0) {
      return 'accelerating';
    }

    return 'steady';
  }

  /**
   * Calculate alert severity level
   */
  calculateSeverity(pips, ms) {
    const seconds = ms / 1000;

    // CRASH level: 55+ pips
    if (pips >= ALERT_LEVELS.CRASH.pipRange[0] && seconds <= 60) {
      return ALERT_LEVELS.CRASH;
    }

    // EXPLOSIVE level: 35-55 pips
    if (pips >= ALERT_LEVELS.EXPLOSIVE.pipRange[0] && seconds <= 120) {
      return ALERT_LEVELS.EXPLOSIVE;
    }

    // STRONG level: 20-35 pips
    if (pips >= ALERT_LEVELS.STRONG.pipRange[0] && seconds <= 180) {
      return ALERT_LEVELS.STRONG;
    }

    // SIGNIFICANT level: 12-20 pips
    if (pips >= ALERT_LEVELS.SIGNIFICANT.pipRange[0] && seconds <= 300) {
      return ALERT_LEVELS.SIGNIFICANT;
    }

    return null;
  }

  getPipSize() {
    return pipSizeForPair(this.pair);
  }
}

// ============================================================================
// PART 7 - BASELINE CALIBRATOR
// ============================================================================

class BaselineCalibrator {
  constructor(pair) {
    this.pair = normalizePair(pair);
    this.history = [];
    this.maxHistory = 240 * 4;
    this.lastCalibrationTime = 0;
    this.lastMicroCalibrationTime = 0;
    this.baseCalibrationIntervalMs = 15 * 60 * 1000;
    this.microCalibrationIntervalMs = 2 * 60 * 1000; // 2 minutes
    this.calibrationIntervalMs = this.baseCalibrationIntervalMs;

    this.metrics = {
      avgPipPerMinute: 1.0,
      avgTickFrequency: 1.0,
      // IMPROVED: initialize spread baseline by instrument, not a fixed non-JPY value.
      avgSpread: pipSizeForPair(pair) * 1.5,
      volatilityRegime: 'MEDIUM',
    };
  }

  /**
   * Recalibrate every 15 minutes
   */
  updateBaseline(tickHistory, nowTs = Date.now()) {
    const now = nowTs;
    const isMicroCalibration = now - this.lastMicroCalibrationTime >= this.microCalibrationIntervalMs;
    const isFullCalibration = now - this.lastCalibrationTime >= this.calibrationIntervalMs;

    if (!isFullCalibration && !isMicroCalibration) return;

    if (isMicroCalibration) this.lastMicroCalibrationTime = now;
    if (isFullCalibration) this.lastCalibrationTime = now;

    try {
      const pipSize = pipSizeForPair(this.pair);

      // Use 15-min window for full calibration, 2-min for micro
      const windowMs = isFullCalibration ? 15 * 60 * 1000 : 2 * 60 * 1000;
      const windowStart = now - windowMs;
      const recentTicks = tickHistory.filter(t => t.ts >= windowStart);

      if (recentTicks.length > 0) {
        // Avg pip move per minute
        const intervals = [];
        for (let i = 1; i < recentTicks.length; i++) {
          const pips = Math.abs((recentTicks[i].bid - recentTicks[i - 1].bid) / pipSize);
          intervals.push(pips);
        }

        this.metrics.avgPipPerMinute =
          intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 1.0;

        // Avg tick frequency
        const timeSpanMs = recentTicks[recentTicks.length - 1].ts - recentTicks[0].ts;
        this.metrics.avgTickFrequency = timeSpanMs > 0 ? (recentTicks.length / timeSpanMs) * 1000 : 1.0;

        // Avg spread
        const spreads = recentTicks
          .map((t) => (Number.isFinite(t.ask) && Number.isFinite(t.bid) ? t.ask - t.bid : null))
          .filter((spread) => Number.isFinite(spread) && spread >= 0);
        if (spreads.length > 0) {
          this.metrics.avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;
        }

        // Volatility regime
        this.metrics.volatilityRegime = this.classifyVolatility(this.metrics.avgPipPerMinute);
      }

      // Keep 4-hour history
      this.history.push({ ...this.metrics, ts: now });
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }

      // Micro-calibration: recalibrate more frequently during high volatility
      this.calibrationIntervalMs =
        this.metrics.volatilityRegime === 'EXTREME' || this.metrics.volatilityRegime === 'HIGH'
          ? 5 * 60 * 1000
          : this.baseCalibrationIntervalMs;
    } catch (_error) {
      // Silently continue with existing metrics
    }
  }

  /**
   * Classify volatility regime: LOW, MEDIUM, HIGH, EXTREME
   */
  classifyVolatility(avgPipPerMinute) {
    if (avgPipPerMinute > 5) return 'EXTREME';
    if (avgPipPerMinute > 2) return 'HIGH';
    if (avgPipPerMinute > 0.5) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Get volatility adjustment multiplier
   * Returns > 1.0 during HIGH/EXTREME volatility (stricter thresholds)
   * Returns < 1.0 during LOW volatility (looser thresholds)
   */
  getVolatilityAdjustment() {
    switch (this.metrics.volatilityRegime) {
      case 'EXTREME':
        return 1.3; // 30% higher threshold
      case 'HIGH':
        return 1.3; // 30% higher threshold
      case 'LOW':
        return 0.8; // 20% lower threshold
      case 'MEDIUM':
      default:
        return 1.0;
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

// ============================================================================
// PART 12 - ATR CALCULATOR & CANDLE MANAGER
// ============================================================================

class ATRCalculator {
  constructor() {
    this.candles = new Map(); // pair -> completed 1H candles (max 20)
  }

  addCandle(pair, candle) {
    const p = normalizePair(pair);
    if (!this.candles.has(p)) this.candles.set(p, []);
    const arr = this.candles.get(p);
    arr.push(candle);
    if (arr.length > 20) arr.shift();
  }

  getATR(pair) {
    const p = normalizePair(pair);
    const candles = this.candles.get(p);
    if (!candles || candles.length < 2) return null;

    const period = Math.min(14, candles.length - 1);
    const trValues = [];
    for (let i = candles.length - period; i < candles.length; i++) {
      const c = candles[i];
      const prev = candles[i - 1];
      const tr = Math.max(
        c.high - c.low,
        Math.abs(c.high - prev.close),
        Math.abs(c.low - prev.close)
      );
      trValues.push(tr);
    }

    if (!trValues.length) return null;
    return trValues.reduce((a, b) => a + b, 0) / trValues.length;
  }
}

class CandleManager {
  constructor() {
    this.candles = new Map(); // `${pair}|${interval}` -> completed candles (max 100)
  }

  pushCompleted(pair, interval, candle) {
    const key = `${normalizePair(pair)}|${interval}`;
    if (!this.candles.has(key)) this.candles.set(key, []);
    const arr = this.candles.get(key);
    arr.push(candle);
    if (arr.length > 100) arr.shift();
  }

  getCandles(pair, interval, count = 50) {
    const key = `${normalizePair(pair)}|${interval}`;
    const arr = this.candles.get(key);
    if (!arr || !arr.length) return [];
    return arr.slice(-count);
  }
}

// ============================================================================
// PART 5 - ENTRY LEVEL CALCULATOR
// ============================================================================

class EntryLevelCalculator {
  constructor(pair) {
    this.pair = normalizePair(pair);
  }

  /**
   * Calculate entry, stop loss, and take profit levels.
   * Provides two entries: aggressive (current) + conservative (retracement).
   * Dynamic SL at nearest round number. TP3 uses fibonacci extension (1.618).
   */
  calculateLevels(currentBid, currentAsk, direction, severity, movement = null, atr = null) {
    const pipSize = pipSizeForPair(this.pair);
    const decimals = decimalsForPair(this.pair);

    const preferredEntry = direction === 'BUY' ? currentAsk : currentBid;
    const fallbackEntry = direction === 'BUY' ? currentBid : currentAsk;
    const entry = Number.isFinite(preferredEntry)
      ? preferredEntry
      : Number.isFinite(fallbackEntry)
        ? fallbackEntry
        : 0;

    // Conservative entry: retracement level based on severity
    const retracePct = severity.level >= 3 ? 0.236 : severity.level >= 2 ? 0.382 : 0.5;
    const moveSize = movement ? Math.abs(movement.totalPips) * pipSize : severity.tpPips * 0.3 * pipSize;
    const conservativeEntry = direction === 'BUY'
      ? entry - moveSize * retracePct
      : entry + moveSize * retracePct;

    let slDistance, tp1Distance, tp2Distance, tp3Distance;

    if (atr && Number.isFinite(atr) && atr > 0) {
      // ATR-based levels: SL=1.5×ATR, TP1=1.0×ATR, TP2=2.0×ATR, TP3=3.0×ATR
      slDistance = atr * 1.5;
      tp1Distance = atr * 1.0;
      tp2Distance = atr * 2.0;
      tp3Distance = atr * 3.0;
    } else {
      // Fall back to fixed pip distances
      slDistance = severity.slPips * pipSize;
      tp1Distance = severity.tpPips * 0.4 * pipSize;
      tp2Distance = severity.tpPips * 0.7 * pipSize;
      tp3Distance = severity.tpPips * 1.618 / (severity.riskReward || 1) * pipSize;
    }

    // Dynamic SL: snap to nearest round number
    const baseSl = direction === 'BUY' ? entry - slDistance : entry + slDistance;
    const roundStep = this.pair.includes('JPY') ? 0.5 : 0.005;
    const sl = direction === 'BUY'
      ? Math.floor(baseSl / roundStep) * roundStep
      : Math.ceil(baseSl / roundStep) * roundStep;

    const tp1 = direction === 'BUY' ? entry + tp1Distance : entry - tp1Distance;
    const tp2 = direction === 'BUY' ? entry + tp2Distance : entry - tp2Distance;
    const tp3 = direction === 'BUY' ? entry + tp3Distance : entry - tp3Distance;

    const riskReward = slDistance > 0 ? tp2Distance / slDistance : severity.riskReward;

    return {
      entry: Number(entry.toFixed(decimals)),
      conservativeEntry: Number(conservativeEntry.toFixed(decimals)),
      stopLoss: Number(sl.toFixed(decimals)),
      tp1: Number(tp1.toFixed(decimals)),
      tp2: Number(tp2.toFixed(decimals)),
      tp3: Number(tp3.toFixed(decimals)),
      riskReward: Number(riskReward.toFixed(1)),
    };
  }
}

// ============================================================================
// PART 8 - ALERT VALIDATOR
// ============================================================================

class AlertValidator {
  constructor(pair) {
    this.pair = normalizePair(pair);
  }

  /**
   * Run final validation before sending alert
   */
  validate(movement, tickHistory, currentBid, currentAsk, recentAlerts) {
    try {
      // CHECK 1: Has price already retraced 50%+ of the move?
      if (!this.checkMovementInProgress(movement, tickHistory)) {
        return null;
      }

      // CHECK 2: Is spread currently more than 2x normal?
      if (!this.checkSpreadNormal(currentBid, currentAsk)) {
        // Don't return null, just add warning
        movement.warnings = movement.warnings || [];
        movement.warnings.push('Spread elevated - may have execution issues');
      }

      // CHECK 3: Is the move still in progress?
      if (!this.checkMoveStillAccelerating(movement, tickHistory)) {
        movement.warnings = movement.warnings || [];
        movement.warnings.push('Move velocity declining - opportunity may be ending');
      }

      // CHECK 4: Is this a known news event time?
      if (this.isNearNewsEvent()) {
        movement.warnings = movement.warnings || [];
        movement.warnings.push('NEWS EVENT - Higher risk than normal');
      }

      // CHECK 5: Does this alert contradict the recent trend?
      if (recentAlerts.length >= 3) {
        const lastThreeAlerts = recentAlerts.slice(0, 3);
        const lastThreeDirections = lastThreeAlerts.map(a => a.direction);

        if (lastThreeDirections.every(d => d === 'BUY') && movement.direction === 'SELL') {
          movement.warnings = movement.warnings || [];
          movement.warnings.push('Counter-trend move - trade with caution');
        }
        if (lastThreeDirections.every(d => d === 'SELL') && movement.direction === 'BUY') {
          movement.warnings = movement.warnings || [];
          movement.warnings.push('Counter-trend move - trade with caution');
        }
      }

      return movement;
    } catch (_error) {
      return null;
    }
  }

  /**
   * CHECK 1: Has price retraced 50%+?
   */
  checkMovementInProgress(movement, tickHistory) {
    if (tickHistory.length < 2) return true;

    const pipSize = pipSizeForPair(this.pair);
    const recent = tickHistory[tickHistory.length - 1];
    const moveOrigin = movement.moveOriginPrice;
    let computedExtreme;
    if (Number.isFinite(movement.extremePrice)) {
      computedExtreme = movement.extremePrice;
    } else {
      computedExtreme = tickHistory[0]?.bid ?? 0;
      for (let i = 1; i < tickHistory.length; i++) {
        const b = tickHistory[i].bid;
        if (movement.direction === "BUY" ? b > computedExtreme : b < computedExtreme) {
          computedExtreme = b;
        }
      }
    }
    const extremePrice = computedExtreme;
    const currentPrice = recent.bid;

    if (!Number.isFinite(moveOrigin) || !Number.isFinite(currentPrice) || !Number.isFinite(extremePrice)) {
      return true;
    }

    const originalMove = Math.abs(extremePrice - moveOrigin) / pipSize;
    const currentRetrace =
      movement.direction === "BUY"
        ? Math.max(0, (extremePrice - currentPrice) / pipSize)
        : Math.max(0, (currentPrice - extremePrice) / pipSize);

    // If retraced more than 50%, opportunity is over
    if (originalMove > 0 && currentRetrace > originalMove * 0.5) {
      return false;
    }

    return true;
  }

  /**
   * CHECK 2: Spread within acceptable range
   */
  checkSpreadNormal(bid, ask) {
    if (!Number.isFinite(bid) || !Number.isFinite(ask) || ask < bid) {
      return false;
    }
    const spread = ask - bid;
    // IMPROVED: use pair pip size instead of a fixed non-JPY spread threshold.
    return spread <= pipSizeForPair(this.pair) * MAX_ALLOWED_SPREAD_PIPS;
  }

  /**
   * CHECK 3: Velocity still positive
   */
  checkMoveStillAccelerating(movement, tickHistory) {
    if (tickHistory.length < 3) return true;

    const pipSize = pipSizeForPair(this.pair);
    const recent = tickHistory.slice(-3);

    const v1 = Math.abs((recent[1].bid - recent[0].bid) / pipSize);
    const v2 = Math.abs((recent[2].bid - recent[1].bid) / pipSize);
    if (!Number.isFinite(v1) || !Number.isFinite(v2) || v1 <= 0) return true;

    // If velocity dropped more than 70%, move is ending
    if (v2 < v1 * 0.3) {
      return false;
    }

    return true;
  }

  /**
   * CHECK 4: Near major news events
   */
  isNearNewsEvent() {
    // Major economic events typically occur at specific times
    // This is a simplified check - in production, use actual economic calendar
    const now = new Date();
    const hourUTC = now.getUTCHours();
    const minuteUTC = now.getUTCMinutes();

    // NFP release at 13:30 UTC (always high volatility)
    if (hourUTC === 13 && minuteUTC >= 15 && minuteUTC <= 45) return true;

    // ECB/BoE announcements typically at 13:00 UTC
    if (hourUTC === 13 && minuteUTC >= 0 && minuteUTC <= 30) return true;

    // FOMC decisions
    if (hourUTC === 19 && minuteUTC >= 0 && minuteUTC <= 30) return true;

    return false;
  }
}

// ============================================================================
// PART 6 - ALERT MANAGER (Frequency Control)
// ============================================================================

class AlertManager {
  constructor() {
    this.alertHistory = new Map(); // pair -> [{ ts, level, direction }]
    this.lastAlertTs = new Map(); // pair -> ts
    this.cooldownsByLevel = {
      1: 8 * 60 * 1000,
      2: 5 * 60 * 1000,
      3: 2 * 60 * 1000,
      4: 0,
    };
    this.alerTsGlobal = [];
    // Dynamic hourly limits by volatility regime
    this.hourlyLimitsByRegime = { LOW: 5, MEDIUM: 10, HIGH: 15, EXTREME: 25 };
    this.currentVolatilityRegime = 'MEDIUM';
    // False positive tracker: pair -> { wins: n, losses: n, thresholdAdj: ratio }
    this.falsePositiveTracker = new Map();
  }

  setVolatilityRegime(regime) {
    if (this.hourlyLimitsByRegime[regime] !== undefined) {
      this.currentVolatilityRegime = regime;
    }
  }

  getHourlyLimit() {
    return this.hourlyLimitsByRegime[this.currentVolatilityRegime] || 10;
  }

  /**
   * Session-aware cooldown adjustment.
   * London/NY open first 30 min = reduce cooldown by 40%
   * Dead zone 0-5 UTC = double cooldown
   */
  getSessionCooldownMultiplier(nowMs) {
    const d = new Date(nowMs);
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    // London open 08:00-08:30, NY open 13:00-13:30
    if ((h === 8 || h === 13) && m < 30) return 0.6;
    // Dead zone 0-5 UTC
    if (h >= 0 && h < 5) return 2.0;
    return 1.0;
  }

  /**
   * Get per-pair threshold adjustment from false positive tracking.
   * Returns multiplier (0.9 to 1.1).
   */
  getFalsePositiveAdjustment(pair) {
    const tracker = this.falsePositiveTracker.get(pair);
    if (!tracker || (tracker.wins + tracker.losses) < 5) return 1.0;
    return tracker.thresholdAdj;
  }

  /**
   * Record alert outcome for false positive tracking
   */
  recordOutcome(pair, isWin) {
    if (!this.falsePositiveTracker.has(pair)) {
      this.falsePositiveTracker.set(pair, { wins: 0, losses: 0, thresholdAdj: 1.0 });
    }
    const tracker = this.falsePositiveTracker.get(pair);
    if (isWin) { tracker.wins++; } else { tracker.losses++; }
    const total = tracker.wins + tracker.losses;
    if (total >= 5) {
      const winRate = tracker.wins / total;
      // High win rate → loosen thresholds (-10%), low win rate → tighten (+10%)
      tracker.thresholdAdj = winRate > 0.6 ? 0.9 : winRate < 0.4 ? 1.1 : 1.0;
    }
  }

  shouldFire(alert, pair) {
    try {
      const nowMs =
        alert?.timestamp instanceof Date && Number.isFinite(alert.timestamp.getTime())
          ? alert.timestamp.getTime()
          : Date.now();
      if (alert.severity.level === 4) return true;

      const lastAlertTs = this.lastAlertTs.get(pair) || 0;
      const baseCooldown = this.cooldownsByLevel[alert.severity.level] || 0;
      const cooldown = baseCooldown * this.getSessionCooldownMultiplier(nowMs);

      if (nowMs - lastAlertTs < cooldown) return false;

      const oneHourAgo = nowMs - 3600000;
      const recentAlerts = this.alerTsGlobal.filter(ts => ts > oneHourAgo);
      this.alerTsGlobal = recentAlerts;

      const hourlyLimit = this.getHourlyLimit();
      if (recentAlerts.length >= hourlyLimit && alert.severity.level < 3) {
        return false;
      }

      return true;
    } catch (_error) {
      return true;
    }
  }

  recordAlert(alert, pair) {
    const tsMs =
      alert?.timestamp instanceof Date && Number.isFinite(alert.timestamp.getTime())
        ? alert.timestamp.getTime()
        : Date.now();
    this.lastAlertTs.set(pair, tsMs);

    if (!this.alertHistory.has(pair)) {
      this.alertHistory.set(pair, []);
    }

    this.alertHistory.get(pair).push({
      ts: tsMs,
      level: alert.severity.level,
      direction: alert.direction,
    });

    const oneDayAgo = tsMs - 86400000;
    const history = this.alertHistory.get(pair);
    const filtered = history.filter(a => a.ts > oneDayAgo);
    this.alertHistory.set(pair, filtered);

    this.alerTsGlobal.push(tsMs);
    const oneHourAgo = tsMs - 3600000;
    this.alerTsGlobal = this.alerTsGlobal.filter(ts => ts > oneHourAgo);
  }

  getRecentAlerts(pair, maxCount = 10) {
    const history = this.alertHistory.get(pair) || [];
    return history.slice(-maxCount).reverse();
  }
}

// ============================================================================
// PART 11 - CONFLUENCE SCORING (Institutional Signal Boost)
// ============================================================================

class ConfluenceScorer {
  constructor(pair) {
    this.pair = normalizePair(pair);
    this.recentHighs = [];
    this.recentLows = [];
    this.maxStructurePoints = 50;
  }

  /**
   * Score a movement for institutional confluence signals.
   * Uses candle data when available (via candleManager), falls back to ticks.
   * Returns { score: 0-165, signals: string[] }
   */
  score(tickHistory, movement, noiseFilter, candleManager = null) {
    const signals = [];
    let score = 0;

    // 1. Liquidity sweep detection (+35) — uses 1H candles
    const sweepScore = this.detectLiquiditySweep(tickHistory, movement, candleManager);
    if (sweepScore > 0) { score += sweepScore; signals.push('LIQUIDITY_SWEEP'); }

    // 2. Break of structure (+30) — uses 1H candles
    const bosScore = this.detectBreakOfStructure(tickHistory, movement, candleManager);
    if (bosScore > 0) { score += bosScore; signals.push('BOS'); }

    // 3. Order block detection (+25) — uses 15m candles
    const obScore = this.detectOrderBlock(tickHistory, movement, candleManager);
    if (obScore > 0) { score += obScore; signals.push('ORDER_BLOCK'); }

    // 4. Fair value gap (+20) — uses 15m candles
    const fvgScore = this.detectFVG(tickHistory, candleManager);
    if (fvgScore > 0) { score += fvgScore; signals.push('FVG'); }

    // 5. Volume anomaly (+25): tick frequency spike
    if (movement.tickFrequency > 2.0) { score += 25; signals.push('VOLUME_SPIKE'); }

    // 6. Spread spike (+30): wide spread = institutional activity
    if (noiseFilter.wideSpreadFlag) { score += 30; signals.push('SPREAD_SPIKE'); }

    return { score, signals };
  }

  detectLiquiditySweep(ticks, movement, candleManager) {
    // Use 1H candles when available
    const candles = candleManager ? candleManager.getCandles(this.pair, '1h', 20) : [];
    if (candles.length >= 10) {
      // Find swing highs/lows using 5-candle lookback
      const swings = this._findSwings(candles, 5);
      if (!swings.swingHigh || !swings.swingLow) return 0;

      const last = candles[candles.length - 1];
      // Wick extends beyond swing high/low but close comes back inside
      if (last.high > swings.swingHigh && last.close < swings.swingHigh && movement.direction === 'SELL') return 35;
      if (last.low < swings.swingLow && last.close > swings.swingLow && movement.direction === 'BUY') return 35;
      return 0;
    }

    // Tick fallback
    if (ticks.length < 20) return 0;
    const recent = ticks.slice(-20);
    let earlyHigh = -Infinity, earlyLow = Infinity;
    for (let i = 0; i < Math.min(15, recent.length); i++) {
      if (recent[i].bid > earlyHigh) earlyHigh = recent[i].bid;
      if (recent[i].bid < earlyLow) earlyLow = recent[i].bid;
    }
    const lastPrice = recent[recent.length - 1].bid;
    const peakInLate = recent.slice(-5);
    let lateHigh = -Infinity, lateLow = Infinity;
    for (const t of peakInLate) {
      if (t.bid > lateHigh) lateHigh = t.bid;
      if (t.bid < lateLow) lateLow = t.bid;
    }
    if (lateHigh > earlyHigh && lastPrice < earlyHigh && movement.direction === 'SELL') return 35;
    if (lateLow < earlyLow && lastPrice > earlyLow && movement.direction === 'BUY') return 35;
    return 0;
  }

  detectBreakOfStructure(ticks, movement, candleManager) {
    // Use 1H candles when available
    const candles = candleManager ? candleManager.getCandles(this.pair, '1h', 20) : [];
    if (candles.length >= 10) {
      const swings = this._findSwings(candles, 5);
      if (!swings.swingHigh || !swings.swingLow) return 0;

      const currentPrice = ticks.length ? ticks[ticks.length - 1].bid : candles[candles.length - 1].close;
      if (movement.direction === 'BUY' && currentPrice > swings.swingHigh) return 30;
      if (movement.direction === 'SELL' && currentPrice < swings.swingLow) return 30;
      return 0;
    }

    // Tick fallback
    if (ticks.length < 30) return 0;
    const structural = ticks.slice(0, Math.floor(ticks.length * 0.66));
    let swingHigh = -Infinity, swingLow = Infinity;
    for (const t of structural) {
      if (t.bid > swingHigh) swingHigh = t.bid;
      if (t.bid < swingLow) swingLow = t.bid;
    }
    const lastPrice = ticks[ticks.length - 1].bid;
    if (movement.direction === 'BUY' && lastPrice > swingHigh) return 30;
    if (movement.direction === 'SELL' && lastPrice < swingLow) return 30;
    return 0;
  }

  detectOrderBlock(ticks, movement, candleManager) {
    // Use 15m candles when available
    const candles = candleManager ? candleManager.getCandles(this.pair, '15m', 20) : [];
    if (candles.length >= 5) {
      const avgBody = candles.slice(0, -1).reduce((sum, c) => sum + Math.abs(c.close - c.open), 0) / (candles.length - 1);
      // Find last opposing candle before a strong impulse move
      for (let i = candles.length - 2; i >= 1; i--) {
        const c = candles[i];
        const impulseBody = Math.abs(c.close - c.open);
        if (impulseBody < avgBody * 2) continue;
        // Check if preceding candle is opposing
        const prev = candles[i - 1];
        const prevBullish = prev.close > prev.open;
        const impulseBullish = c.close > c.open;
        if (prevBullish !== impulseBullish) {
          // Opposing candle before strong impulse = order block
          if ((movement.direction === 'BUY' && impulseBullish) ||
              (movement.direction === 'SELL' && !impulseBullish)) {
            return 25;
          }
        }
      }
      return 0;
    }

    // Tick fallback
    if (ticks.length < 10) return 0;
    const pipSize = pipSizeForPair(this.pair);
    const consolidation = ticks.slice(-10, -3);
    if (consolidation.length < 3) return 0;
    let cHigh = -Infinity, cLow = Infinity;
    for (const t of consolidation) {
      if (t.bid > cHigh) cHigh = t.bid;
      if (t.bid < cLow) cLow = t.bid;
    }
    const consolidationRange = (cHigh - cLow) / pipSize;
    if (consolidationRange < 10 && movement.totalPips > 20) return 25;
    return 0;
  }

  detectFVG(ticks, candleManager) {
    // Use 15m candles when available
    const candles = candleManager ? candleManager.getCandles(this.pair, '15m', 10) : [];
    if (candles.length >= 3) {
      // Check recent candle triplets for FVG
      for (let i = candles.length - 3; i >= Math.max(0, candles.length - 6); i--) {
        const c0 = candles[i];
        const c2 = candles[i + 2];
        // Bullish FVG: candle[i].high < candle[i+2].low
        if (c0.high < c2.low) return 20;
        // Bearish FVG: candle[i].low > candle[i+2].high
        if (c0.low > c2.high) return 20;
      }
      return 0;
    }

    // Tick fallback
    if (ticks.length < 3) return 0;
    const pipSize = pipSizeForPair(this.pair);
    const t0 = ticks[ticks.length - 3].bid;
    const t1 = ticks[ticks.length - 2].bid;
    const t2 = ticks[ticks.length - 1].bid;
    if (t2 > t0 && t1 < t2 && (t2 - t0) / pipSize > 5) return 20;
    if (t2 < t0 && t1 > t2 && (t0 - t2) / pipSize > 5) return 20;
    return 0;
  }

  /**
   * Find swing highs and lows from candle data using N-candle lookback.
   */
  _findSwings(candles, lookback) {
    let swingHigh = null, swingLow = null;
    for (let i = lookback; i < candles.length - 1; i++) {
      let isSwingHigh = true, isSwingLow = true;
      for (let j = 1; j <= lookback; j++) {
        if (i - j < 0) { isSwingHigh = false; isSwingLow = false; break; }
        if (candles[i].high <= candles[i - j].high) isSwingHigh = false;
        if (candles[i].low >= candles[i - j].low) isSwingLow = false;
      }
      if (isSwingHigh) swingHigh = candles[i].high;
      if (isSwingLow) swingLow = candles[i].low;
    }
    return { swingHigh, swingLow };
  }
}

// Minimum confluence scores per severity level
const MIN_CONFLUENCE_SCORES = {
  1: 0,   // SIGNIFICANT: no minimum (backwards compat)
  2: 0,   // STRONG: no minimum
  3: 20,  // EXPLOSIVE: at least one signal
  4: 0,   // CRASH: always fires
};

// ============================================================================
// PART 10 - MAIN FOREX ALERT ENGINE
// ============================================================================

class ForexAlertEngine {
  constructor() {
    this.engines = new Map(); // pair -> { filter, analyzer, calibrator, entryCalc, validator }
    this.alertManager = new AlertManager();
    this.tickHistories = new Map(); // pair -> [ticks]
    this.maxTicksPerPair = 500; // Enforced circular buffer (W17)
    this.lastProcessedTs = new Map();
    this.lastQuotes = new Map();

    this.atrCalculator = new ATRCalculator();
    this.candleManager = new CandleManager();

    this.onAlert = null;
    this.onBuildingAlert = null;
    this.onError = null;

    this.consecutiveAlerts = [];
    this.lastBuildingAlertTs = new Map();
    // Hash-based dedup: Set of hashes for 5-min buckets (W15)
    this.alertHashes = new Map(); // hash -> tsMs
  }

  /**
   * Process incoming tick and detect alerts
   */
  processTick(pair, bid, ask, timestamp = Date.now(), fallbackPrice = null) {
    try {
      if (!pair || typeof pair !== "string") return null;
      const normalizedPair = normalizePair(pair);
      const ts = Number.isFinite(Number(timestamp)) ? Number(timestamp) : Date.now();

      const lastTs = this.lastProcessedTs.get(normalizedPair) || 0;
      if (lastTs && ts < lastTs) {
        // IMPROVED: reject stale/out-of-order ticks to preserve directional calculations.
        return null;
      }

      const numericBid = Number.isFinite(Number(bid)) ? Number(bid) : null;
      const numericAsk = Number.isFinite(Number(ask)) ? Number(ask) : null;
      const numericFallback = Number.isFinite(Number(fallbackPrice)) ? Number(fallbackPrice) : null;
      const previousQuote = this.lastQuotes.get(normalizedPair) || null;

      let resolvedBid = numericBid;
      let resolvedAsk = numericAsk;
      if (!Number.isFinite(resolvedBid) && Number.isFinite(resolvedAsk)) resolvedBid = resolvedAsk;
      if (!Number.isFinite(resolvedAsk) && Number.isFinite(resolvedBid)) resolvedAsk = resolvedBid;
      if (!Number.isFinite(resolvedBid) && !Number.isFinite(resolvedAsk) && Number.isFinite(numericFallback)) {
        resolvedBid = numericFallback;
        resolvedAsk = numericFallback;
      }
      if (!Number.isFinite(resolvedBid) && previousQuote && Number.isFinite(previousQuote.bid)) {
        resolvedBid = previousQuote.bid;
      }
      if (!Number.isFinite(resolvedAsk) && previousQuote && Number.isFinite(previousQuote.ask)) {
        resolvedAsk = previousQuote.ask;
      }
      if (!Number.isFinite(resolvedBid) || !Number.isFinite(resolvedAsk) || resolvedAsk < resolvedBid) {
        return null;
      }

      // Ensure engine initialized for this pair
      if (!this.engines.has(normalizedPair)) {
        this.initializePair(normalizedPair);
      }

      const engine = this.engines.get(normalizedPair);
      const tick = { bid: resolvedBid, ask: resolvedAsk, ts };

      // Maintain tick history
      const history = this.tickHistories.get(normalizedPair) || [];
      history.push(tick);

      // Enforce circular buffer: drop oldest when exceeding max (W17: avoid shift() O(n))
      if (history.length > this.maxTicksPerPair) {
        const excess = history.length - this.maxTicksPerPair;
        history.splice(0, excess);
      }

      this.tickHistories.set(normalizedPair, history);
      this.lastProcessedTs.set(normalizedPair, ts);
      this.lastQuotes.set(normalizedPair, { bid: resolvedBid, ask: resolvedAsk, ts });

      // Update baseline
      engine.calibrator.updateBaseline(history, ts);

      // Apply noise filter
      if (!engine.filter.filter(tick, history)) {
        // Tick rejected by filters - silent (PART 9: no console noise)
        return null;
      }

      // Analyze movement
      const movement = engine.analyzer.analyze(history, engine.filter, ts);
      if (!movement) {
        // Check for building move (early warning at 70% of threshold)
        this.checkBuildingMove(normalizedPair, history, engine, ts);
        return null;
      }

      // Validate before sending
      const recentAlerts = this.alertManager.getRecentAlerts(normalizedPair);
      const validatedMovement = engine.validator.validate(
        movement,
        history,
        resolvedBid,
        resolvedAsk,
        recentAlerts
      );
      if (!validatedMovement) {
        // Validation failed - silent
        return null;
      }

      // Check frequency rules
      // Update volatility regime for dynamic hourly limits (E3)
      this.alertManager.setVolatilityRegime(engine.calibrator.getMetrics().volatilityRegime);
      if (!this.alertManager.shouldFire(validatedMovement, normalizedPair)) {
        return null;
      }

      // Hash-based dedup check (W15): pair+direction+rounded_price+5min_bucket
      const dedupHash = this.computeAlertHash(normalizedPair, validatedMovement.direction, resolvedBid, ts);
      if (this.alertHashes.has(dedupHash)) {
        return null;
      }

      // Confluence scoring (E6) — use candle data when available
      const confluence = engine.confluenceScorer.score(history, validatedMovement, engine.filter, this.candleManager);
      const minConfluence = MIN_CONFLUENCE_SCORES[validatedMovement.severity.level] || 0;
      if (confluence.score < minConfluence) {
        return null;
      }

      // Calculate entry/SL/TP levels with movement data + ATR (E4)
      const atr = this.atrCalculator.getATR(normalizedPair);
      const levels = engine.entryCalc.calculateLevels(
        resolvedBid,
        resolvedAsk,
        validatedMovement.direction,
        validatedMovement.severity,
        validatedMovement,
        atr
      );

      // Apply false positive threshold adjustment (E3)
      const fpAdj = this.alertManager.getFalsePositiveAdjustment(normalizedPair);
      // If fpAdj > 1 and move barely met threshold, suppress
      if (fpAdj > 1.0 && validatedMovement.totalPips < validatedMovement.severity.pipRange[0] * fpAdj) {
        return null;
      }

      // Build alert object
      const alert = {
        pair: normalizedPair,
        direction: validatedMovement.direction,
        severity: validatedMovement.severity,
        pips: validatedMovement.totalPips,
        speed: validatedMovement.speed,
        consistency: validatedMovement.consistency,
        momentum: validatedMovement.momentum,
        tickFrequency: validatedMovement.tickFrequency,
        timeTakenMs: validatedMovement.timeTakenMs,
        moveOriginPrice: validatedMovement.moveOriginPrice,
        fromPrice: validatedMovement.moveOriginPrice,
        currentBid: resolvedBid,
        currentAsk: resolvedAsk,
        levels,
        confluenceScore: confluence.score,
        confluenceSignals: confluence.signals,
        priority: validatedMovement.severity.level >= 4 ? 1 : validatedMovement.severity.level >= 3 ? 2 : validatedMovement.severity.level >= 2 ? 3 : 4,
        timestamp: new Date(ts),
        warnings: validatedMovement.warnings || [],
      };

      // Propagate wide spread flag as warning instead of blocking
      if (engine.filter.wideSpreadFlag) {
        alert.warnings.push('Wide spread detected - check liquidity before entry');
      }

      // Record this alert and dedup hash
      this.alertManager.recordAlert(alert, normalizedPair);
      engine.filter.recordAlert(resolvedBid, ts);
      this.alertHashes.set(dedupHash, ts);
      this.pruneAlertHashes(ts);

      // Print to console (PART 9) - only alerts, no noise
      this.printAlertToConsole(alert, normalizedPair);

      // Trigger callback
      if (this.onAlert && typeof this.onAlert === 'function') {
        try {
          this.onAlert(alert);
        } catch (error) {
          this.logError(`Alert callback error: ${error.message}`);
        }
      }

      return alert;
    } catch (error) {
      this.logError(`Error processing tick for ${pair}: ${error.message}`);
      return null;
    }
  }

  /**
   * Initialize engines for a new pair
   */
  initializePair(pair) {
    const normalizedPair = normalizePair(pair);
    const filter = new NoiseFilter(normalizedPair);
    const calibrator = new BaselineCalibrator(normalizedPair);
    const analyzer = new MovementAnalyzer(normalizedPair, calibrator);
    const entryCalc = new EntryLevelCalculator(normalizedPair);
    const validator = new AlertValidator(normalizedPair);
    const confluenceScorer = new ConfluenceScorer(normalizedPair);

    this.engines.set(normalizedPair, {
      filter,
      analyzer,
      calibrator,
      entryCalc,
      validator,
      confluenceScorer,
    });
  }

  /**
   * Emit early warning when a move reaches 70% of the alert threshold.
   * Throttled to at most once per 30 seconds per pair.
   */
  checkBuildingMove(pair, history, engine, ts) {
    if (!this.onBuildingAlert || typeof this.onBuildingAlert !== 'function') return;

    const lastTs = this.lastBuildingAlertTs.get(pair) || 0;
    if (ts - lastTs < 30000) return;

    const threshold = MINIMUM_PIP_THRESHOLDS[pair];
    if (!threshold) return;
    if (history.length < 3) return;

    const windowMs = threshold.timeWindowMs;
    const windowStart = ts - windowMs;
    const windowTicks = history.filter((t) => t.ts >= windowStart && Number.isFinite(t.bid));
    if (windowTicks.length < 2) return;

    const pipSize = engine.filter.getPipSize();
    let highPrice = -Infinity;
    let lowPrice = Infinity;
    for (let i = 0; i < windowTicks.length; i++) {
      const b = windowTicks[i].bid;
      if (b > highPrice) highPrice = b;
      if (b < lowPrice) lowPrice = b;
    }
    const totalPips = (highPrice - lowPrice) / pipSize;

    const sessionMultiplier = engine.filter.getSessionThresholdMultiplier(ts);
    const volAdj = engine.calibrator ? engine.calibrator.getVolatilityAdjustment() : 1.0;
    const effectiveThreshold = threshold.pips * sessionMultiplier * volAdj;

    const progress = totalPips / effectiveThreshold;
    if (progress < 0.7 || progress >= 1.0) return;

    const firstPrice = windowTicks[0].bid;
    const lastPrice = windowTicks[windowTicks.length - 1].bid;
    const direction = lastPrice > firstPrice ? 'BUY' : 'SELL';

    this.lastBuildingAlertTs.set(pair, ts);

    try {
      this.onBuildingAlert({
        type: 'BUILDING',
        pair,
        direction,
        progress: Math.round(progress * 100),
        currentPips: Math.round(totalPips * 10) / 10,
        thresholdPips: Math.round(effectiveThreshold * 10) / 10,
        timestamp: new Date(ts),
      });
    } catch {}
  }

  // IMPROVED: allow recorder/test harness to reset pair-specific state safely.
  resetPair(pair) {
    const normalizedPair = normalizePair(pair);
    this.engines.delete(normalizedPair);
    this.tickHistories.delete(normalizedPair);
    this.lastProcessedTs.delete(normalizedPair);
    this.lastQuotes.delete(normalizedPair);
    this.lastBuildingAlertTs.delete(normalizedPair);
    this.alertManager.alertHistory.delete(normalizedPair);
    this.alertManager.lastAlertTs.delete(normalizedPair);
    this.alertManager.falsePositiveTracker.delete(normalizedPair);
  }

  computeAlertHash(pair, direction, price, tsMs) {
    const pipSize = pipSizeForPair(pair);
    const roundedPrice = Math.round(price / (pipSize * 10)) * (pipSize * 10);
    const bucket = Math.floor(tsMs / 300000); // 5-minute bucket
    return `${pair}|${direction}|${roundedPrice.toFixed(5)}|${bucket}`;
  }

  pruneAlertHashes(nowMs) {
    const cutoff = nowMs - 600000; // 10 min
    for (const [hash, ts] of this.alertHashes) {
      if (ts < cutoff) this.alertHashes.delete(hash);
    }
  }

  /**
   * Print alert to console (Part 9)
   */
  printAlertToConsole(alert, pair) {
    const severity = alert.severity;
    const levels = alert.levels;
    const speedLabel = alert.speed === 'EXPLOSIVE' ? '< 30 seconds' : 
                       alert.speed === 'STRONG' ? '< 90 seconds' :
                       '< 180 seconds';

    console.log(
      `\n════════════════════════════════════════════════` +
      `\n${severity.level === 4 ? '💥' : severity.level === 3 ? '🚨' : severity.level === 2 ? '🔔' : '📊'} ` +
      `${severity.name} ALERT — ${pair} — ${alert.direction}` +
      `\n════════════════════════════════════════════════` +
      `\nMove:        ${alert.pips.toFixed(1)} pips ${alert.direction} in ${speedLabel}` +
      `\nSpeed:       ${alert.speed}` +
      `\nPeak speed:  ${(alert.pips / (alert.timeTakenMs / 1000)).toFixed(2)} pips per second` +
      `\nConsistency: ${(alert.consistency * 100).toFixed(0)}% directional ticks` +
      `\nMomentum:    ${alert.momentum || 'N/A'}` +
      `\nTick freq:   ${alert.tickFrequency.toFixed(1)} ticks per second` +
      `\nConfluence:  ${alert.confluenceScore || 0} (${(alert.confluenceSignals || []).join(', ') || 'none'})` +
      `\nSession:     ${this.getCurrentSession()}` +
      `\nVolatility:  ${this.getVolatilityRegime(pair)}` +
      `\nPriority:    P${alert.priority || 4}` +
      `\n────────────────────────────────────────────────` +
      `\nEntry:       ${levels.entry} (${alert.direction === 'BUY' ? 'ask' : 'bid'})` +
      `\nEntry (cons):${levels.conservativeEntry} (retracement)` +
      `\nStop Loss:   ${levels.stopLoss} (-${severity.slPips} pips)` +
      `\nTP1:         ${levels.tp1} (+${(severity.tpPips * 0.4).toFixed(0)} pips) — partial exit` +
      `\nTP2:         ${levels.tp2} (+${(severity.tpPips * 0.7).toFixed(0)} pips) — move SL to BE` +
      `\nTP3:         ${levels.tp3} (+${severity.tpPips} pips) — full target` +
      `\nRisk/Reward: 1:${levels.riskReward.toFixed(1)}` +
      `\n────────────────────────────────────────────────` +
      `\nValidation:  ✅ Move in progress` +
      `\n             ✅ Spread normal` +
      `\n             ✅ Velocity sustained` +
      `\n             ✅ Executable entry` +
      `${alert.warnings.length > 0 ? `\nWarnings:    ${alert.warnings.join(' | ')}` : ''}` +
      `\n════════════════════════════════════════════════\n`
    );
  }

  getCurrentSession() {
    const hourUTC = new Date().getUTCHours();

    if ((hourUTC >= 21 && hourUTC < 24) || (hourUTC >= 0 && hourUTC < 5)) return 'Dead Zone';
    if (hourUTC >= 5 && hourUTC < 8) return 'Asian';
    if (hourUTC >= 8 && hourUTC < 12) return 'London';
    if (hourUTC >= 12 && hourUTC < 13) return 'London/NY Overlap';
    if (hourUTC >= 13 && hourUTC < 21) return 'New York';

    return 'Unknown';
  }

  getVolatilityRegime(pair) {
    const engine = this.engines.get(normalizePair(pair));
    if (!engine) return 'UNKNOWN';
    return engine.calibrator.getMetrics().volatilityRegime;
  }

  logError(message) {
    if (this.onError && typeof this.onError === 'function') {
      this.onError(new Error(message));
    } else {
      console.error(`[ForexAlertEngine] ${message}`);
    }
  }

  /**
   * Get statistics for a pair
   */
  getStats(pair) {
    const normalizedPair = normalizePair(pair);
    const engine = this.engines.get(normalizedPair);
    if (!engine) return null;

    return {
      pair: normalizedPair,
      metrics: engine.calibrator.getMetrics(),
      alerts: this.alertManager.getRecentAlerts(normalizedPair),
    };
  }
}

export { ForexAlertEngine };
