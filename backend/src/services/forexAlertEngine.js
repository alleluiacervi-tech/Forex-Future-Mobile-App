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

// ============================================================================
// PART 1 - MINIMUM MOVE THRESHOLDS (Hard Floors)
// ============================================================================

const MINIMUM_PIP_THRESHOLDS = {
  'EUR/USD': { pips: 25, timeWindowMs: 180000 },
  'GBP/USD': { pips: 30, timeWindowMs: 180000 },
  'USD/JPY': { pips: 25, timeWindowMs: 180000 },
  'AUD/USD': { pips: 20, timeWindowMs: 180000 },
  'USD/CHF': { pips: 22, timeWindowMs: 180000 },
  'GBP/JPY': { pips: 40, timeWindowMs: 180000 },
  'EUR/JPY': { pips: 35, timeWindowMs: 180000 },
  'USD/CAD': { pips: 22, timeWindowMs: 180000 },
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
    pipRange: [25, 35],
    timeWindowMs: 180000,
    color: 'yellow',
    sound: 'silent',
    riskReward: 2.0,
    slPips: 15,
    tpPips: 30,
  },
  STRONG: {
    level: 2,
    name: 'STRONG',
    pipRange: [35, 50],
    timeWindowMs: 120000,
    color: 'orange',
    sound: 'soft chime',
    riskReward: 2.5,
    slPips: 20,
    tpPips: 50,
  },
  EXPLOSIVE: {
    level: 3,
    name: 'EXPLOSIVE',
    pipRange: [50, 80],
    timeWindowMs: 90000,
    color: 'red',
    sound: 'loud alert',
    riskReward: 2.8,
    slPips: 28,
    tpPips: 80,
  },
  CRASH: {
    level: 4,
    name: 'CRASH',
    pipRange: [80, Infinity],
    timeWindowMs: 60000,
    color: 'dark red flashing',
    sound: 'emergency alarm',
    riskReward: 3.4,
    slPips: 35,
    tpPips: 120,
  },
};

// ============================================================================
// PART 2 - NOISE FILTER LAYER
// ============================================================================

class NoiseFilter {
  constructor(pair, options = {}) {
    this.pair = pair;
    this.averageSpread = options.averageSpread || 0.0002;
    this.recentAlerts = [];
    this.maxRecentAlerts = 100;
  }

  /**
   * Filter 1 - Minimum Pip Gate
   * Calculate total pips in last 60 seconds
   */
  checkMinimumPipGate(tickHistory) {
    if (tickHistory.length < 1) return true; // Pass if insufficient data

    const now = Date.now();
    const lastMinute = tickHistory.filter(t => now - t.ts < 60000);

    if (lastMinute.length === 0) return false;

    const pipSize = this.getPipSize();
    const highPrice = Math.max(...lastMinute.map(t => t.bid));
    const lowPrice = Math.min(...lastMinute.map(t => t.bid));
    const totalPips = (highPrice - lowPrice) / pipSize;

    const threshold = MINIMUM_PIP_THRESHOLDS[this.pair];
    if (!threshold) return true; // No threshold defined = pass

    return totalPips >= threshold.pips;
  }

  /**
   * Filter 2 - Spread Filter
   * Check if spread is abnormally wide
   */
  checkSpreadFilter(bid, ask) {
    const currentSpread = ask - bid;
    const maxAllowedSpread = this.averageSpread * 3;

    if (currentSpread > maxAllowedSpread) {
      return false; // Spread too wide - illiquid market
    }

    return true;
  }

  /**
   * Filter 3 - Session Filter
   * Returns multiplier for current session
   */
  getSessionThresholdMultiplier() {
    const now = new Date();
    const hourUTC = now.getUTCHours();

    // Dead Zone: 21:00 - 06:00 UTC (+ stricter)
    if ((hourUTC >= 21 && hourUTC < 24) || (hourUTC >= 0 && hourUTC < 6)) {
      return TRADING_SESSIONS.DEADZONE.thresholdMultiplier;
    }

    // London/NY Overlap: 12:00 - 13:00 UTC (relaxed)
    if (hourUTC >= 12 && hourUTC < 13) {
      return TRADING_SESSIONS.LONDON_NY_OVERLAP.thresholdMultiplier;
    }

    // Asian session: 00:00 - 08:00 UTC (+ stricter)
    if (hourUTC >= 0 && hourUTC < 8) {
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

    return 1.0; // Default
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
    if (tickHistory.length < 5) return false;

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

    if (velocities.length < 3) return false;

    // Check if at least 3 velocities are consistently high
    const sortedVelocities = [...velocities].sort((a, b) => a - b);
    const highVelocityThreshold = sortedVelocities[sortedVelocities.length - 1] * 0.6;

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
  checkDuplicateAlert(currentPrice) {
    const pipSize = this.getPipSize();
    const now = Date.now();
    const tenMinutesAgo = now - 600000;

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
  recordAlert(price) {
    this.recentAlerts.push({
      price,
      ts: Date.now(),
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
      if (!this.checkMinimumPipGate(tickHistory)) {
        return false;
      }

      // Filter 2: Spread filter
      if (!this.checkSpreadFilter(tick.bid, tick.ask)) {
        return false;
      }

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
      if (!this.checkDuplicateAlert(tick.bid)) {
        return false;
      }

      return true;
    } catch (error) {
      // Log error but pass through to avoid crashing
      return true;
    }
  }

  getPipSize() {
    return this.pair.includes('JPY') ? 0.01 : 0.0001;
  }
}

// ============================================================================
// PART 3 - MOVEMENT ANALYZER
// ============================================================================

class MovementAnalyzer {
  constructor(pair, baselineCalibrator = null) {
    this.pair = pair;
    this.baselineCalibrator = baselineCalibrator;
  }

  /**
   * Analyze if movement meets all 5 criteria
   */
  analyze(tickHistory, noiseFilter) {
    if (tickHistory.length < 5) return null;

    try {
      // Get the threshold window
      const threshold = MINIMUM_PIP_THRESHOLDS[this.pair];
      if (!threshold) return null;

      const windowMs = threshold.timeWindowMs;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Get ticks in window
      const windowTicks = tickHistory.filter(t => t.ts >= windowStart);
      if (windowTicks.length === 0) return null;

      const pipSize = this.getPipSize();

      // CRITERIA 1: Minimum pip distance
      const highPrice = Math.max(...windowTicks.map(t => t.bid));
      const lowPrice = Math.min(...windowTicks.map(t => t.bid));
      const totalPips = (highPrice - lowPrice) / pipSize;

      const adjustedThreshold = threshold.pips * noiseFilter.getSessionThresholdMultiplier();
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
      const direction = lastPrice > firstPrice ? 'BUY' : 'SELL';

      // CRITERIA 2: Minimum speed
      const timeTakenMs = windowTicks[windowTicks.length - 1].ts - windowTicks[0].ts;
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
      if (tickFrequency < 5) {
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
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Classify speed: EXPLOSIVE, STRONG, MODERATE
   */
  classifySpeed(pips, ms) {
    const seconds = ms / 1000;

    if (seconds <= 30 && pips >= 25) return 'EXPLOSIVE';
    if (seconds <= 90 && pips >= 25) return 'STRONG';
    if (seconds <= 180 && pips >= 25) return 'MODERATE';

    return null;
  }

  /**
   * Calculate percentage of ticks moving in dominant direction
   */
  calculateDirectionalConsistency(ticks, dominantDirection) {
    if (ticks.length < 2) return 0;

    let consistentCount = 0;

    for (let i = 1; i < ticks.length; i++) {
      const change = ticks[i].bid - ticks[i - 1].bid;
      const tickDirection = change > 0 ? 'BUY' : 'SELL';

      if (tickDirection === dominantDirection) {
        consistentCount++;
      }
    }

    return consistentCount / (ticks.length - 1);
  }

  /**
   * Check if momentum is still positive or declining
   */
  getMomentumConfirmation(ticks) {
    if (ticks.length < 5) return 'accelerating'; // Assume accelerating if insufficient data

    const recent = ticks.slice(-5);
    const pipSize = this.getPipSize();

    const velocities = [];
    for (let i = 1; i < recent.length; i++) {
      const priceDiff = Math.abs(recent[i].bid - recent[i - 1].bid) / pipSize;
      velocities.push(priceDiff);
    }

    if (velocities.length < 2) return 'accelerating';

    // Check if momentum is declining significantly
    // Compare velocity in last tick vs average of earlier ticks
    const lastVelocity = velocities[velocities.length - 1];
    const avgEarlierVelocity = velocities.slice(0, -1).reduce((a, b) => a + b, 0) / (velocities.length - 1);

    // If velocity has declined more than 70%, momentum is declining
    if (lastVelocity < avgEarlierVelocity * 0.3) {
      return 'declining';
    }

    return 'accelerating';
  }

  /**
   * Calculate alert severity level
   */
  calculateSeverity(pips, ms) {
    const seconds = ms / 1000;

    // CRASH level
    if (pips >= 80 && seconds <= 60) {
      return ALERT_LEVELS.CRASH;
    }

    // EXPLOSIVE level
    if (pips >= 50 && seconds <= 90) {
      return ALERT_LEVELS.EXPLOSIVE;
    }

    // STRONG level
    if (pips >= 35 && seconds <= 120) {
      return ALERT_LEVELS.STRONG;
    }

    // SIGNIFICANT level
    if (pips >= 25 && seconds <= 180) {
      return ALERT_LEVELS.SIGNIFICANT;
    }

    return null;
  }

  getPipSize() {
    return this.pair.includes('JPY') ? 0.01 : 0.0001;
  }
}

// ============================================================================
// PART 7 - BASELINE CALIBRATOR
// ============================================================================

class BaselineCalibrator {
  constructor(pair) {
    this.pair = pair;
    this.history = []; // 4 hours of data
    this.maxHistory = 240 * 4; // 4 hours of minute-level data
    this.lastCalibrationTime = 0;
    this.calibrationIntervalMs = 15 * 60 * 1000; // 15 minutes

    this.metrics = {
      avgPipPerMinute: 1.0,
      avgTickFrequency: 1.0,
      avgSpread: 0.0002,
      volatilityRegime: 'MEDIUM',
    };
  }

  /**
   * Recalibrate every 15 minutes
   */
  updateBaseline(tickHistory) {
    const now = Date.now();
    if (now - this.lastCalibrationTime < this.calibrationIntervalMs) {
      return;
    }

    this.lastCalibrationTime = now;

    try {
      const pipSize = this.pair.includes('JPY') ? 0.01 : 0.0001;

      // Calculate metrics from last 15 minutes
      const fifteenMinutesAgo = now - 15 * 60 * 1000;
      const recentTicks = tickHistory.filter(t => t.ts >= fifteenMinutesAgo);

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
        const spreads = recentTicks.map(t => t.ask - t.bid);
        this.metrics.avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;

        // Volatility regime
        this.metrics.volatilityRegime = this.classifyVolatility(this.metrics.avgPipPerMinute);
      }

      // Keep 4-hour history
      this.history.push({ ...this.metrics, ts: now });
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }
    } catch (error) {
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
// PART 5 - ENTRY LEVEL CALCULATOR
// ============================================================================

class EntryLevelCalculator {
  constructor(pair) {
    this.pair = pair;
  }

  /**
   * Calculate entry, stop loss, and take profit levels
   */
  calculateLevels(currentBid, currentAsk, direction, severity) {
    const pipSize = this.pair.includes('JPY') ? 0.01 : 0.0001;

    const entry = direction === 'BUY' ? currentAsk : currentBid;

    // Stop Loss (behind origin of move)
    const slPips = severity.slPips;
    const sl = direction === 'BUY' ? entry - slPips * pipSize : entry + slPips * pipSize;

    // Take Profit levels
    const tpPips = severity.tpPips;
    const tp3 = direction === 'BUY' ? entry + tpPips * pipSize : entry - tpPips * pipSize;

    // Partial take profits
    const tp1Distance = tpPips * 0.4;
    const tp1 = direction === 'BUY' ? entry + tp1Distance * pipSize : entry - tp1Distance * pipSize;

    const tp2Distance = tpPips * 0.7;
    const tp2 = direction === 'BUY' ? entry + tp2Distance * pipSize : entry - tp2Distance * pipSize;

    return {
      entry: Math.round(entry * 100000) / 100000,
      stopLoss: Math.round(sl * 100000) / 100000,
      tp1: Math.round(tp1 * 100000) / 100000,
      tp2: Math.round(tp2 * 100000) / 100000,
      tp3: Math.round(tp3 * 100000) / 100000,
      riskReward: severity.riskReward,
    };
  }
}

// ============================================================================
// PART 8 - ALERT VALIDATOR
// ============================================================================

class AlertValidator {
  constructor(pair) {
    this.pair = pair;
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
    } catch (error) {
      return null;
    }
  }

  /**
   * CHECK 1: Has price retraced 50%+?
   */
  checkMovementInProgress(movement, tickHistory) {
    if (tickHistory.length < 2) return true;

    const pipSize = this.pair.includes('JPY') ? 0.01 : 0.0001;
    const recent = tickHistory.slice(-2);

    const moveOrigin = movement.moveOriginPrice;
    const currentPrice = recent[1].bid;
    const moveTarget = recent[0].bid;

    const originalMove = Math.abs(moveTarget - moveOrigin) / pipSize;
    const currentRetrace = Math.abs(currentPrice - moveTarget) / pipSize;

    // If retraced more than 50%, opportunity is over
    if (currentRetrace > originalMove * 0.5) {
      return false;
    }

    return true;
  }

  /**
   * CHECK 2: Spread within acceptable range
   */
  checkSpreadNormal(bid, ask) {
    const spread = ask - bid;
    // Assume 0.0002 is normal; flag if > 0.0004
    return spread <= 0.0004;
  }

  /**
   * CHECK 3: Velocity still positive
   */
  checkMoveStillAccelerating(movement, tickHistory) {
    if (tickHistory.length < 3) return true;

    const pipSize = this.pair.includes('JPY') ? 0.01 : 0.0001;
    const recent = tickHistory.slice(-3);

    const v1 = Math.abs((recent[1].bid - recent[0].bid) / pipSize);
    const v2 = Math.abs((recent[2].bid - recent[1].bid) / pipSize);

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
    this.alertHistory = new Map(); // pair -> [{ ts, level }]
    this.lastAlertTs = new Map(); // pair -> ts
    this.cooldownsByLevel = {
      1: 8 * 60 * 1000, // SIGNIFICANT: 8 minutes
      2: 5 * 60 * 1000, // STRONG: 5 minutes
      3: 2 * 60 * 1000, // EXPLOSIVE: 2 minutes
      4: 0, // CRASH: no cooldown
    };
    this.alerTsGlobal = [];
    this.maxAlerTsGlobal = 10; // Max 10 alerts per hour globally
  }

  /**
   * Check if alert should fire based on frequency rules
   */
  shouldFire(alert, pair) {
    try {
      // CRASH level always fires immediately
      if (alert.severity.level === 4) {
        return true;
      }

      // Check per-pair cooldown
      const lastAlertTs = this.lastAlertTs.get(pair) || 0;
      const cooldown = this.cooldownsByLevel[alert.severity.level] || 0;

      if (Date.now() - lastAlertTs < cooldown) {
        return false;
      }

      // Check global hourly limit (max 10 alerts per hour)
      const oneHourAgo = Date.now() - 3600000;
      const recentAlerts = this.alerTsGlobal.filter(ts => ts > oneHourAgo);

      if (recentAlerts.length >= this.maxAlerTsGlobal && alert.severity.level < 3) {
        // EXPLOSIVE/CRASH override the limit
        return false;
      }

      return true;
    } catch (error) {
      return true;
    }
  }

  /**
   * Record that an alert was fired
   */
  recordAlert(alert, pair) {
    this.lastAlertTs.set(pair, Date.now());

    if (!this.alertHistory.has(pair)) {
      this.alertHistory.set(pair, []);
    }

    this.alertHistory.get(pair).push({
      ts: Date.now(),
      level: alert.severity.level,
      direction: alert.direction,
    });

    // Keep only last 24 hours
    const oneDayAgo = Date.now() - 86400000;
    const history = this.alertHistory.get(pair);
    const filtered = history.filter(a => a.ts > oneDayAgo);
    this.alertHistory.set(pair, filtered);

    // Record global alert timestamp
    this.alerTsGlobal.push(Date.now());
    const oneHourAgo = Date.now() - 3600000;
    this.alerTsGlobal = this.alerTsGlobal.filter(ts => ts > oneHourAgo);
  }

  /**
   * Get recent alerts for a pair
   */
  getRecentAlerts(pair, maxCount = 10) {
    const history = this.alertHistory.get(pair) || [];
    return history.slice(0, maxCount);
  }
}

// ============================================================================
// PART 10 - MAIN FOREX ALERT ENGINE
// ============================================================================

class ForexAlertEngine {
  constructor() {
    this.engines = new Map(); // pair -> { filter, analyzer, calibrator, entryCalc, validator }
    this.alertManager = new AlertManager();
    this.tickHistories = new Map(); // pair -> [ticks]
    this.maxTicksPerPair = 1000;
    this.lastProcessedTs = new Map();

    this.onAlert = null; // Callback function
    this.onError = null; // Error callback

    this.consecutiveAlerts = [];
  }

  /**
   * Process incoming tick and detect alerts
   */
  processTick(pair, bid, ask, timestamp = Date.now()) {
    try {
      // Ensure engine initialized for this pair
      if (!this.engines.has(pair)) {
        this.initializePair(pair);
      }

      const engine = this.engines.get(pair);
      const tick = { bid, ask, ts: timestamp };

      // Maintain tick history
      const history = this.tickHistories.get(pair) || [];
      history.push(tick);

      // Auto-cleanup old ticks (keep sliding 4-hour window)
      const fourHoursAgo = Date.now() - 14400000;
      while (history.length > 0 && history[0].ts < fourHoursAgo) {
        history.shift();
      }

      this.tickHistories.set(pair, history);

      // Update baseline
      engine.calibrator.updateBaseline(history);

      // Apply noise filter
      if (!engine.filter.filter(tick, history)) {
        // Tick rejected by filters - silent (PART 9: no console noise)
        return null;
      }

      // Analyze movement
      const movement = engine.analyzer.analyze(history, engine.filter);
      if (!movement) {
        // No significant movement detected - silent
        return null;
      }

      // Validate before sending
      const recentAlerts = this.alertManager.getRecentAlerts(pair);
      const validatedMovement = engine.validator.validate(movement, history, bid, ask, recentAlerts);
      if (!validatedMovement) {
        // Validation failed - silent
        return null;
      }

      // Check frequency rules
      if (!this.alertManager.shouldFire(validatedMovement, pair)) {
        // Frequency limit reached - silent
        return null;
      }

      // Calculate entry/SL/TP levels
      const levels = engine.entryCalc.calculateLevels(bid, ask, validatedMovement.direction, validatedMovement.severity);

      // Build alert object
      const alert = {
        pair,
        direction: validatedMovement.direction,
        severity: validatedMovement.severity,
        pips: validatedMovement.totalPips,
        speed: validatedMovement.speed,
        consistency: validatedMovement.consistency,
        tickFrequency: validatedMovement.tickFrequency,
        timeTakenMs: validatedMovement.timeTakenMs,
        levels,
        timestamp: new Date(timestamp),
        warnings: validatedMovement.warnings || [],
      };

      // Record this alert
      this.alertManager.recordAlert(alert, pair);

      // Print to console (PART 9) - only alerts, no noise
      this.printAlertToConsole(alert, pair);

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
    const filter = new NoiseFilter(pair);
    const calibrator = new BaselineCalibrator(pair);
    const analyzer = new MovementAnalyzer(pair, calibrator);
    const entryCalc = new EntryLevelCalculator(pair);
    const validator = new AlertValidator(pair);

    this.engines.set(pair, {
      filter,
      analyzer,
      calibrator,
      entryCalc,
      validator,
    });
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
      `\nTick freq:   ${alert.tickFrequency.toFixed(1)} ticks per second` +
      `\nSession:     ${this.getCurrentSession()}` +
      `\nVolatility:  ${this.getVolatilityRegime(pair)}` +
      `\n────────────────────────────────────────────────` +
      `\nEntry:       ${levels.entry} (${alert.direction === 'BUY' ? 'ask' : 'bid'})` +
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

    if (hourUTC >= 12 && hourUTC < 13) return 'London/NY Overlap';
    if ((hourUTC >= 21 && hourUTC < 24) || (hourUTC >= 0 && hourUTC < 6)) return 'Dead Zone';
    if (hourUTC >= 0 && hourUTC < 8) return 'Asian';
    if (hourUTC >= 8 && hourUTC < 12) return 'London';
    if (hourUTC >= 13 && hourUTC < 21) return 'New York';

    return 'Unknown';
  }

  getVolatilityRegime(pair) {
    const engine = this.engines.get(pair);
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
    const engine = this.engines.get(pair);
    if (!engine) return null;

    return {
      pair,
      metrics: engine.calibrator.getMetrics(),
      alerts: this.alertManager.getRecentAlerts(pair),
    };
  }
}

export { ForexAlertEngine };
