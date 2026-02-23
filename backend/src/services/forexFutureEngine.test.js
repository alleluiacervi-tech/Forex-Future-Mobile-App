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
  // create a micro burst
  for (let i = 0; i < 6; i++) {
    buf.addTick({ tsMs: i * 100, price: 1.0 + i * 0.0005 });
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

// Full engine test with synthetic data
(() => {
  const engine = new ForexFutureEngine();
  const alerts = engine.runSyntheticTest();
  assert(Array.isArray(alerts), "should return an array");
  assert(alerts.length > 0, "synthetic test should generate alerts");
  console.log("ForexFutureEngine synthetic test passed");
})();

console.log("all forexFutureEngine tests completed");
