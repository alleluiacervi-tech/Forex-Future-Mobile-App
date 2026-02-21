import assert from "assert";
import { validateTick, isTickOutlier } from "./marketValidator.js";
import { maybeCreateAlerts, state } from "./marketRecorder.js";

// simple utilities for constructing ticks
const makeTick = (tsMs, price, priceType = "last") => ({ tsMs, price, priceType });

console.log("running market validator/recorder unit tests...");

// -- validateTick tests -----------------------------------------------------
(() => {
  const good = validateTick({ pair: "EURUSD", tsMs: 1000, price: 1.2345, priceType: "mid" });
  assert(good.ok, "expected valid tick to pass");

  const badPrice = validateTick({ pair: "EURUSD", tsMs: 1000, price: 1.23456, priceType: "mid" });
  assert(!badPrice.ok && badPrice.issues.some((i) => /pip/.test(i)), "should reject bad pip scaling");

  const badType = validateTick({ pair: "EURUSD", tsMs: 1000, price: 1.23456, priceType: "foo" });
  assert(!badType.ok, "unsupported priceType should be rejected");

  console.log("validateTick tests passed");
})();

// -- isTickOutlier tests ---------------------------------------------------
(() => {
  const baseTicks = [
    makeTick(0, 1.0, "last"),
    makeTick(1000, 1.001, "last"),
    makeTick(2000, 1.002, "last")
  ];
  const normal = isTickOutlier(baseTicks, makeTick(3000, 1.003, "last"));
  assert(!normal, "small incremental moves should not be outliers");

  const wild = isTickOutlier(baseTicks, makeTick(3000, 1.1, "last"));
  assert(wild, "big jump should be flagged as outlier");

  console.log("isTickOutlier tests passed");
})();

// -- maybeCreateAlerts smoke ------------------------------------------------
(async () => {
  // reset state
  state.consecutiveMoveCounts.clear();
  state.lastAlertKeyAt.clear();
  state.ticksByPair.clear();

  process.env.MARKET_ALERT_THRESHOLD_1M = "0.01"; // 1% tiny threshold
  process.env.MARKET_ALERT_EXTREME_MULTIPLIER = "5";

  const pair = "EURUSD";
  const ticks = [];
  const ts0 = Date.now();
  ticks.push(makeTick(ts0, 1.0, "last"));
  // second tick is one minute later, reference tick will be the first one
  ticks.push(makeTick(ts0 + 60000, 1.003, "last")); // +0.3% over 60s (threshold 0.12, not extreme)

  // call once – should generate a candidate alert because > threshold
  const alerts = await maybeCreateAlerts({ pair, tsMs: ts0 + 60000, price: 1.003, ticks, priceType: "last" });
  assert(Array.isArray(alerts) && alerts.length > 0, "an alert should have been returned");
  assert(state.lastAlertKeyAt.size > 0, "state should also record an alert key");

  console.log("maybeCreateAlerts smoke test passed");
})();

console.log("all tests completed");
