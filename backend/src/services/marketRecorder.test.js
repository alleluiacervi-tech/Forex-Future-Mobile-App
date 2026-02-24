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

// -- maybeCreateAlerts engine integration smoke --------------------------------
(async () => {
  // clear state
  state.ticksByPair.clear();
  state.lastAlertKeyAt.clear();
  const pair = "EURUSD";
  const ticks = [];
  const ts0 = Date.now();
  // two ticks to prime velocity
  ticks.push(makeTick(ts0, 1.0, "last"));
  ticks.push(makeTick(ts0 + 500, 1.0001, "last"));
  // burst
  ticks.push(makeTick(ts0 + 1000, 1.005, "last"));
  const alerts = await maybeCreateAlerts({ pair, tsMs: ts0 + 1000, price: 1.005, ticks, priceType: "last" });
  assert(Array.isArray(alerts), "engine should return array");
  console.log("maybeCreateAlerts engine integration smoke passed");
})();

// ensure fromPrice from engine propagates through recorder wrapper by
// feeding ticks sequentially since the engine maintains internal state.
(async () => {
  state.ticksByPair.clear();
  state.lastAlertKeyAt.clear();
  const pair = "EURUSD";
  const ts0 = Date.now();
  // feed three ticks as in engine unit tests
  await maybeCreateAlerts({ pair, tsMs: ts0, price: 1.0, priceType: "last" });
  await maybeCreateAlerts({ pair, tsMs: ts0 + 500, price: 1.0001, priceType: "last" });
  const alerts = await maybeCreateAlerts({ pair, tsMs: ts0 + 1000, price: 1.005, priceType: "last" });
  assert(alerts.length > 0 && alerts[0].fromPrice != null, "recorder should surface fromPrice");
  console.log("maybeCreateAlerts fromPrice propagation test passed");
})();

// -- maybeCreateAlerts smoke ------------------------------------------------
(async () => {
  if (process.env.RUN_MARKET_RECORDER_SMOKE !== "true") {
    console.log("skipping maybeCreateAlerts smoke test (set RUN_MARKET_RECORDER_SMOKE=true to enable)");
    return;
  }

  let recorderModule;
  try {
    recorderModule = await import("./marketRecorder.js");
  } catch (error) {
    const reason = error?.message ? String(error.message) : "module failed to load";
    console.warn(`skipping maybeCreateAlerts smoke test (${reason})`);
    return;
  }

  const { maybeCreateAlerts, state } = recorderModule;

  // reset state
  state.consecutiveMoveCounts.clear();
  state.lastAlertKeyAt.clear();
  state.ticksByPair.clear();

  // feed ticks sequentially through the engine to simulate real operation
  const pair = "EURUSD";
  const ts0 = Date.now();
  let alerts;

  // normal ticks
  alerts = await maybeCreateAlerts({ pair, tsMs: ts0, price: 1.0000, priceType: "last" });
  alerts = await maybeCreateAlerts({ pair, tsMs: ts0 + 100, price: 1.0001, priceType: "last" });
  alerts = await maybeCreateAlerts({ pair, tsMs: ts0 + 200, price: 1.0002, priceType: "last" });

  // now a velocity burst
  alerts = await maybeCreateAlerts({ pair, tsMs: ts0 + 300, price: 1.0100, priceType: "last" });
  assert(Array.isArray(alerts) && alerts.length > 0, "should fire alert on burst");
  console.log("maybeCreateAlerts sequential smoke test passed");
})();

console.log("all tests completed");
