import assert from "assert";
import {
  TickBuffer,
  CandleBuilder,
  VelocityEngine,
  SmartMoneyEngine,
  ConfluenceEngine,
  AlertManager,
  ForexFutureEngine,
  CONFIG
} from "./forexFutureEngine.js";
import { supportedPairs } from "./marketSymbols.js";

console.log("running forexFutureEngine unit tests...");

// TickBuffer basics
(() => {
  const buf = new TickBuffer("EURUSD");
  buf.addTick({ tsMs: 0, price: 1.0 });
  buf.addTick({ tsMs: 500, price: 1.0002 });
  const v = buf.getVelocity(500);
  assert(v && Number.isFinite(v.velocity), "velocity should compute");
  console.log("TickBuffer tests passed");
})();

// CandleBuilder basics
(() => {
  const cb = new CandleBuilder("EURUSD");
  cb.addTick({ tsMs: 1000, price: 1.0 });
  cb.addTick({ tsMs: 61000, price: 1.001 });
  const hist = cb.getHistory(60000);
  assert(hist.length === 1, "one candle should have closed");
  console.log("CandleBuilder tests passed");
})();

// VelocityEngine simple check
(() => {
  const buf = new TickBuffer("EURUSD");
  const ve = new VelocityEngine();
  // seed with a slow movement to create a previous velocity
  buf.addTick({ tsMs: 0, price: 1.0 });
  buf.addTick({ tsMs: 500, price: 1.0001 }); // 1 pip in 0.5s -> 2 pips/sec
  ve.analyze("EURUSD", buf); // record previous velocity value
  // now add a rapid burst over 500ms (25 pips move)
  const start = buf.buffer[buf.buffer.length - 1].tsMs;
  for (let i = 1; i <= 5; i++) {
    buf.addTick({ tsMs: start + i * 100, price: 1.0001 + i * 0.0005 });
  }
  const res = ve.analyze("EURUSD", buf);
  assert(res.some((r) => r.signal === "MICRO_BURST"), "should detect micro burst");
  console.log("VelocityEngine tests passed");
})();

// SmartMoneyEngine smoke
(() => {
  const sm = new SmartMoneyEngine();
  const now = Date.now();
  // feed ticks to produce a liquidity sweep later
  for (let i = 0; i < 100; i++) {
    sm.processTick("EURUSD", { tsMs: now + i * 60000, price: 1.0 + i * 0.0001 });
  }
  console.log("SmartMoneyEngine smoke (no errors) passed");
})();

// Spread spike detection test
(() => {
  const buf = new TickBuffer("EURUSD");
  const sm = new SmartMoneyEngine();
  // feed 60 ticks with normal spread 0.0001
  for (let i = 0; i < 60; i++) {
    buf.addTick({ tsMs: i * 1000, price: 1.1, bid: 1.1, ask: 1.1001 });
  }
  // now sudden spread spike
  const tick = { tsMs: 61000, price: 1.1, bid: 1.1, ask: 1.1005 };
  const signals = sm._detectSpreadSpike("EURUSD", buf, tick);
  assert(signals.some((s) => s.signal === "SPREAD_SPIKE"), "spread spike should be detected");
  console.log("Spread spike detection test passed");
})();

// verify baseline map includes every supported pair
(() => {
  const { velocity } = CONFIG;
  const norm = (p) => p.replace(/\//g, "").toUpperCase();
  const keys = new Set(Object.keys(velocity.baseline));
  supportedPairs.forEach((p) => {
    const key = norm(p);
    assert(keys.has(key), `baseline missing for ${p}`);
  });
  assert(keys.has("XAUUSD"), "baseline must include gold XAUUSD");
  console.log("baseline coverage test passed");
})();

// ensure constant price never triggers an alert
(() => {
  const engine = new ForexFutureEngine();
  const pair = "EURUSD";
  const now = Date.now();
  let total = 0;
  for (let i = 0; i < 20; i++) {
    const a = engine.processTick(pair, 1.2, "last", now + i * 100);
    total += a.length;
  }
  assert(total === 0, "no alerts should fire when price is flat");
  console.log("flat price no-alert test passed");
})();

// pair cooldown should prevent back-to-back alerts
(() => {
  const engine = new ForexFutureEngine();
  const pair = "EURUSD";
  const now = Date.now();
  // mimic earlier manual example that produced a micro burst
  const a1 = engine.processTick(pair, 1.1000, "last", now);
  const a2 = engine.processTick(pair, 1.1001, "last", now + 500);
  assert(a1.length + a2.length > 0, "an early alert should fire on first or second tick");
  // third move within cooldown should be suppressed
  const third = engine.processTick(pair, 1.1021, "last", now + 1100);
  assert(third.length === 0, "third alert should be suppressed by pair cooldown");
  console.log("pair cooldown test passed");
})();

// verify fromPrice is set when a velocity signal is generated.  the alert will
// typically fire on the second tick in our sequence, so capture results from
// each processTick invocation.
(() => {
  const engine = new ForexFutureEngine();
  const pair = "EURUSD";
  const now = Date.now();
  engine.processTick(pair, 1.0, "last", now);
  const alerts1 = engine.processTick(pair, 1.001, "last", now + 500);
  const alerts2 = engine.processTick(pair, 1.003, "last", now + 1000);
  const alerts = [...alerts1, ...alerts2];
  assert(alerts.length > 0, "should produce at least one alert");
  const alert = alerts[0];
  assert(alert.fromPrice !== undefined, "alert should include fromPrice");
  if (alert.velocity && alert.velocity.startPrice != null) {
    assert(alert.fromPrice === alert.velocity.startPrice, "fromPrice should match velocity.startPrice");
  }
  console.log("fromPrice assignment test passed");
})();

// Full engine test with synthetic data
(() => {
  const engine = new ForexFutureEngine();
  const alerts = engine.runSyntheticTest();
  assert(Array.isArray(alerts), "should return an array");
  assert(alerts.length > 0, "synthetic test should generate alerts");
  console.log("ForexFutureEngine synthetic test passed");
})();

console.log("all forexFutureEngine tests completed");
