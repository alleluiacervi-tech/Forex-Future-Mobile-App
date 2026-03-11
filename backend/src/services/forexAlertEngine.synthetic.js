import http from "http";
import { performance } from "perf_hooks";
import { WebSocket, WebSocketServer } from "ws";
import initializeSocket from "./socket.js";
import { ForexAlertEngine } from "./forexAlertEngine.js";

// IMPROVED: deterministic synthetic scenario runner requested for post-change verification.
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (predicate, timeoutMs = 5000, pollMs = 25) => {
  const start = performance.now();
  while (performance.now() - start <= timeoutMs) {
    const value = predicate();
    if (value) return value;
    await wait(pollMs);
  }
  throw new Error(`Timed out after ${timeoutMs}ms`);
};

const createEngine = () => {
  const engine = new ForexAlertEngine();
  engine.printAlertToConsole = () => {};
  return engine;
};

const runQuietMarketTest = async () => {
  const engine = createEngine();
  const pair = "EUR/USD";
  const startTs = Date.now();
  let bid = 1.1;
  let alerts = 0;

  for (let i = 0; i < 300; i += 1) {
    bid += i % 2 === 0 ? 0.000005 : -0.000004;
    const alert = engine.processTick(pair, bid, bid + 0.0001, startTs + i * 200);
    if (alert) alerts += 1;
  }

  return {
    pass: alerts === 0,
    detail: `alerts=${alerts}`
  };
};

const runGradualVelocityTest = async () => {
  const engine = createEngine();
  const pair = "EUR/USD";
  const startTs = Date.now();
  let bid = 1.1;
  let firstAlert = null;

  for (let i = 0; i < 80; i += 1) {
    const increment = 0.00001 + i * 0.000004;
    bid += increment;
    const alert = engine.processTick(pair, bid, bid + 0.0001, startTs + i * 500);
    if (alert) {
      firstAlert = alert;
      break;
    }
  }

  const detectionMs = firstAlert ? firstAlert.timestamp.getTime() - startTs : null;
  const pass = Boolean(firstAlert && firstAlert.pips >= 25);

  return {
    pass,
    detail: pass
      ? `pips=${firstAlert.pips.toFixed(2)}, detectionMs=${detectionMs}`
      : "no alert fired"
  };
};

const runFlashCrashTest = async () => {
  const engine = createEngine();
  const pair = "EUR/USD";
  const startTs = Date.now();

  engine.processTick(pair, 1.1, 1.1001, startTs);
  engine.processTick(pair, 1.095, 1.0951, startTs + 200);
  const alert = engine.processTick(pair, 1.09, 1.0901, startTs + 400);

  const pass = Boolean(alert && alert.severity?.name === "CRASH" && alert.timeTakenMs <= 500);
  return {
    pass,
    detail: alert
      ? `severity=${alert.severity?.name}, timeTakenMs=${alert.timeTakenMs}`
      : "no alert fired"
  };
};

const runChoppyNoiseTest = async () => {
  const engine = createEngine();
  const pair = "EUR/USD";
  const startTs = Date.now();
  let bid = 1.2;
  let alerts = 0;

  for (let i = 0; i < 120; i += 1) {
    bid += i % 2 === 0 ? 0.00035 : -0.00034;
    const alert = engine.processTick(pair, bid, bid + 0.0001, startTs + i * 300);
    if (alert) alerts += 1;
  }

  return {
    pass: alerts === 0,
    detail: `alerts=${alerts}`
  };
};

const runBadDataTest = async () => {
  const engine = createEngine();
  const pair = "EUR/USD";
  const badTicks = [
    { bid: Number.NaN, ask: 1.1001 },
    { bid: 1.1001, ask: Number.NaN },
    { bid: 1.1002, ask: 1.1 },
    { bid: null, ask: null },
    { bid: Infinity, ask: Infinity }
  ];

  let threw = false;
  let nonNullCount = 0;
  badTicks.forEach((tick, index) => {
    try {
      const alert = engine.processTick(pair, tick.bid, tick.ask, Date.now() + index * 10);
      if (alert) nonNullCount += 1;
    } catch {
      threw = true;
    }
  });

  return {
    pass: !threw && nonNullCount === 0,
    detail: `throws=${threw}, nonNullAlerts=${nonNullCount}`
  };
};

const runSocketReconnectTest = async () => {
  const upstreamServer = new WebSocketServer({ port: 0 });
  await new Promise((resolve) => upstreamServer.on("listening", resolve));
  const upstreamPort = upstreamServer.address().port;

  const upstreamConnections = [];
  upstreamServer.on("connection", (ws) => {
    const connection = { ws, joins: [] };
    upstreamConnections.push(connection);
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === "join_symbol") {
          connection.joins.push(msg);
        }
      } catch {}
    });
  });

  const backendServer = http.createServer((_req, res) => {
    res.statusCode = 200;
    res.end("ok");
  });

  const backendWs = initializeSocket({
    server: backendServer,
    fcsUrl: `ws://127.0.0.1:${upstreamPort}`,
    fcsApiKey: "synthetic",
    upstreamReconnectMs: 200,
    upstreamHeartbeatMs: 1000,
    marketHoursEnforced: false,
    enableSyntheticTicks: false,
    logConnections: false,
    logUpstreamMessages: false,
    logUpstreamSamples: false
  });

  await new Promise((resolve) => backendServer.listen(0, "127.0.0.1", resolve));
  const backendPort = backendServer.address().port;
  const downstreamClient = new WebSocket(`ws://127.0.0.1:${backendPort}/ws/market`);
  const received = [];

  downstreamClient.on("message", (raw) => {
    try {
      received.push(JSON.parse(raw.toString()));
    } catch {}
  });

  try {
    await waitFor(() => downstreamClient.readyState === WebSocket.OPEN, 5000);
    const firstUpstream = await waitFor(() => upstreamConnections[0], 5000);
    await waitFor(() => firstUpstream.joins.length > 0, 5000);

    firstUpstream.ws.send(
      JSON.stringify({
        type: "price",
        symbol: "FX:EURUSD",
        timeframe: "60",
        prices: { c: 1.1111, update: Date.now(), v: 1, b: 1.111, a: 1.1112 }
      })
    );
    await waitFor(() => received.some((msg) => msg?.type === "trade"), 5000);

    const reconnectStart = performance.now();
    firstUpstream.ws.close();

    const secondUpstream = await waitFor(() => upstreamConnections[1], 7000);
    await waitFor(() => secondUpstream.joins.length > 0, 5000);
    secondUpstream.ws.send(
      JSON.stringify({
        type: "price",
        symbol: "FX:EURUSD",
        timeframe: "60",
        prices: { c: 1.2222, update: Date.now(), v: 1, b: 1.2221, a: 1.2223 }
      })
    );
    await waitFor(() => received.filter((msg) => msg?.type === "trade").length >= 2, 5000);
    const reconnectMs = Math.round(performance.now() - reconnectStart);

    return {
      pass: true,
      detail: `reconnectMs=${reconnectMs}, firstJoins=${firstUpstream.joins.length}, secondJoins=${secondUpstream.joins.length}`
    };
  } catch (error) {
    return {
      pass: false,
      detail: error?.message || "unknown socket reconnect failure"
    };
  } finally {
    try {
      downstreamClient.close();
    } catch {}
    try {
      backendWs?.closeGracefully?.();
    } catch {}
    try {
      upstreamServer.close();
    } catch {}
    try {
      backendServer.close();
    } catch {}
  }
};

const run = async () => {
  const scenarios = [
    { name: "Test 1: Quiet market -> zero alerts", fn: runQuietMarketTest },
    { name: "Test 2: Gradual velocity build -> threshold alert", fn: runGradualVelocityTest },
    { name: "Test 3: Flash crash -> alert within 500ms", fn: runFlashCrashTest },
    { name: "Test 4: Choppy noise -> zero alerts", fn: runChoppyNoiseTest },
    { name: "Test 5: Bad data -> rejected without crash", fn: runBadDataTest },
    { name: "Test 6: WS disconnect/reconnect -> resubscribe", fn: runSocketReconnectTest }
  ];

  const results = [];
  for (const scenario of scenarios) {
    const started = performance.now();
    let pass = false;
    let detail = "";
    try {
      const output = await scenario.fn();
      pass = Boolean(output?.pass);
      detail = output?.detail || "";
    } catch (error) {
      pass = false;
      detail = error?.message || "unexpected failure";
    }
    const durationMs = Math.round(performance.now() - started);
    results.push({ name: scenario.name, pass, durationMs, detail });
  }

  console.log("\nSynthetic Tick Verification Results");
  results.forEach((result) => {
    const status = result.pass ? "PASS" : "FAIL";
    console.log(`${status} | ${result.name} | durationMs=${result.durationMs} | ${result.detail}`);
  });

  const failed = results.filter((result) => !result.pass).length;
  if (failed > 0) {
    process.exitCode = 1;
  }
};

void run();
