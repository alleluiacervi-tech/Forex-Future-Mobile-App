import { WebSocket, WebSocketServer } from "ws";
import { recordQuote, recordTrade } from "./marketCache.js";
import { basePrices, supportedSymbols, symbolToPair } from "./marketSymbols.js";

/**
 * Professional WS Market Stream
 * Path: /ws/market
 *
 * Features:
 * - Upstream Finnhub WS relay
 * - Server-side ping/pong heartbeat (detect dead clients)
 * - Backpressure protection (skip sends if buffer is high)
 * - Clean interval lifecycle
 * - Baseline + ref-counted upstream subscriptions
 */

const DEFAULTS = {
  path: "/ws/market",
  pingMs: 15000,              // ping frequency
  clientTimeoutMs: 30000,     // terminate if no pong within this window
  maxBufferedBytes: 1_000_000, // ~1MB backpressure threshold
  maxPendingUpstreamMessages: Number(process.env.WS_MAX_PENDING_UPSTREAM_MESSAGES || 1000),
  // If Finnhub is connected but not sending data, optionally generate synthetic ticks in dev.
  enableSyntheticTicks:
    process.env.MARKET_WS_SYNTHETIC_TICKS === "true" ||
    (!process.env.NODE_ENV || process.env.NODE_ENV !== "production"),
  forceSyntheticTicks: process.env.MARKET_WS_FORCE_SYNTHETIC_TICKS === "true",
  syntheticTickMs: Number(process.env.MARKET_WS_SYNTHETIC_MS || 1000),
  upstreamSilentMs: Number(process.env.MARKET_WS_UPSTREAM_SILENT_MS || 15000),
  // In local/dev, allow running without Finnhub to avoid startup crashes.
  allowNoUpstream:
    process.env.ALLOW_NO_FINNHUB_WS === "true" ||
    (process.env.NODE_ENV && process.env.NODE_ENV !== "production"),
  finnhubUrl:
    process.env.FINNHUB_WS_URL ||
    (process.env.FINNHUB_API_KEY
      ? `wss://ws.finnhub.io?token=${process.env.FINNHUB_API_KEY}`
      : ""),
  finnhubReconnectMs: 5000,
  logConnections: true,
  logUpstreamMessages:
    process.env.MARKET_WS_DEBUG === "true" || process.env.WS_LOG_UPSTREAM_MESSAGES === "true",
  logUpstreamSamples:
    process.env.MARKET_WS_DEBUG === "true" || process.env.WS_LOG_UPSTREAM_SAMPLES === "true"
};

const safeJson = (obj) => {
  try {
    return JSON.stringify(obj);
  } catch {
    return JSON.stringify({ type: "error", ts: new Date().toISOString(), message: "JSON encode failed" });
  }
};

const nowIso = () => new Date().toISOString();

const initializeSocket = ({ server, heartbeatMs, ...opts } = {}) => {
  if (!server) throw new Error("initializeSocket: missing { server }");

  const config = {
    ...DEFAULTS,
    ...opts
  };

  // Backward compatibility: heartbeatMs retained but unused in Finnhub relay mode
  if (Number.isFinite(Number(heartbeatMs)) && Number(heartbeatMs) > 0) {
    config.pingMs = Number(heartbeatMs);
  }

  if (!config.finnhubUrl && !config.allowNoUpstream) {
    throw new Error("initializeSocket: missing FINNHUB_API_KEY or FINNHUB_WS_URL");
  }

  const wss = new WebSocketServer({ server, path: config.path });

  // Track subscriptions per client and aggregate symbol counts
  const clientState = new WeakMap();
  const symbolCounts = new Map();
  const defaultSymbols = supportedSymbols;
  // Always keep a baseline subscription so REST endpoints still receive updates
  const alwaysSubscribedSymbols = new Set(defaultSymbols);

  const sendJson = (ws, messageObj) => {
    if (ws.readyState !== WebSocket.OPEN) return;

    // Backpressure guard: if client is slow, skip sending to avoid memory buildup
    if (ws.bufferedAmount > config.maxBufferedBytes) return;

    ws.send(safeJson(messageObj));
  };

  const sendRaw = (ws, rawMessage) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > config.maxBufferedBytes) return;
    ws.send(rawMessage);
  };

  // Synthetic ticks (dev fallback)
  let syntheticTimer = null;
  const syntheticPriceBySymbol = new Map();

  const isJpyPair = (pair) => String(pair || "").includes("JPY");
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const nextSyntheticPrice = (symbol) => {
    const pair = symbolToPair[symbol];
    if (!pair) return null;

    const base = basePrices[pair];
    const current = Number.isFinite(syntheticPriceBySymbol.get(symbol))
      ? syntheticPriceBySymbol.get(symbol)
      : base;

    const jitter = isJpyPair(pair) ? 0.005 : 0.00005;
    const pull = isJpyPair(pair) ? 0.0005 : 0.000005;
    const drift = (Math.random() - 0.5) * jitter;
    const meanRevert = Number.isFinite(base) ? (base - current) * pull : 0;
    const next = Number.isFinite(current) ? current + drift + meanRevert : base;

    // keep within a sane range in case basePrices are stale
    const min = Number.isFinite(base) ? base * 0.7 : -Infinity;
    const max = Number.isFinite(base) ? base * 1.3 : Infinity;
    const clamped = clamp(next, min, max);

    syntheticPriceBySymbol.set(symbol, clamped);
    return clamped;
  };

  const startSyntheticTicks = (reason) => {
    if (!config.enableSyntheticTicks) return;
    if (syntheticTimer) return;
    const tickMs = Number.isFinite(Number(config.syntheticTickMs)) && Number(config.syntheticTickMs) > 0
      ? Number(config.syntheticTickMs)
      : 1000;

    if (config.logConnections) {
      // eslint-disable-next-line no-console
      console.warn(`Market WS: starting synthetic ticks (${reason || "fallback"}) every ${tickMs}ms`);
    }

    syntheticTimer = setInterval(() => {
      const ts = Date.now();
      supportedSymbols.forEach((symbol) => {
        const price = nextSyntheticPrice(symbol);
        if (!Number.isFinite(price)) return;
        recordTrade({ symbol, price, timestampMs: ts, volume: 0 });

        const payload = safeJson({
          type: "trade",
          data: [{ s: symbol, p: price, t: ts, v: 0 }]
        });
        wss.clients.forEach((ws) => {
          sendRaw(ws, payload);
        });
      });
    }, tickMs);
  };

  const stopSyntheticTicks = () => {
    if (!syntheticTimer) return;
    clearInterval(syntheticTimer);
    syntheticTimer = null;
    if (config.logConnections) {
      // eslint-disable-next-line no-console
      console.warn("Market WS: stopped synthetic ticks (upstream resumed).");
    }
  };

  // Upstream Finnhub connection
  let finnhub = null;
  let finnhubReconnectTimer = null;
  let finnhubOpenedAt = 0;
  let lastUpstreamDataAt = 0;
  const pendingFinnhubMessages = [];
  const maxPendingUpstreamMessages =
    Number.isFinite(Number(config.maxPendingUpstreamMessages)) && Number(config.maxPendingUpstreamMessages) > 0
      ? Number(config.maxPendingUpstreamMessages)
      : 1000;
  let warnedPendingQueueOverflow = false;

  const enqueueFinnhubPayload = (payload) => {
    pendingFinnhubMessages.push(payload);
    if (pendingFinnhubMessages.length > maxPendingUpstreamMessages) {
      // Drop oldest to prevent unbounded memory growth during upstream outages.
      pendingFinnhubMessages.splice(0, pendingFinnhubMessages.length - maxPendingUpstreamMessages);
      if (!warnedPendingQueueOverflow && config.logUpstreamMessages) {
        warnedPendingQueueOverflow = true;
        // eslint-disable-next-line no-console
        console.warn(
          `Finnhub WS: pending message queue overflow (capped at ${maxPendingUpstreamMessages}). Dropping oldest messages.`
        );
      }
    }
  };

  const flushFinnhubQueue = () => {
    if (!finnhub || finnhub.readyState !== WebSocket.OPEN) return;
    while (pendingFinnhubMessages.length > 0) {
      const payload = pendingFinnhubMessages.shift();
      try {
        finnhub.send(payload);
      } catch {
        break;
      }
    }
  };

  const sendToFinnhub = (messageObj) => {
    if (!config.finnhubUrl) return;
    const payload = safeJson(messageObj);
    if (!finnhub || finnhub.readyState !== WebSocket.OPEN) {
      enqueueFinnhubPayload(payload);
      return;
    }
    try {
      finnhub.send(payload);
    } catch {
      enqueueFinnhubPayload(payload);
    }
  };

  const resubscribeAllSymbols = () => {
    if (!config.finnhubUrl) return;
    alwaysSubscribedSymbols.forEach((symbol) => {
      sendToFinnhub({ type: "subscribe", symbol });
    });
    symbolCounts.forEach((count, symbol) => {
      if (count > 0 && !alwaysSubscribedSymbols.has(symbol)) {
        sendToFinnhub({ type: "subscribe", symbol });
      }
    });
  };

  const scheduleFinnhubReconnect = () => {
    if (!config.finnhubUrl) return;
    if (finnhubReconnectTimer) return;
    finnhubReconnectTimer = setTimeout(() => {
      finnhubReconnectTimer = null;
      connectFinnhub();
    }, config.finnhubReconnectMs);
  };

  const connectFinnhub = () => {
    if (!config.finnhubUrl) return;
    try {
      finnhub = new WebSocket(config.finnhubUrl);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create Finnhub WS:", error.message);
      scheduleFinnhubReconnect();
      return;
    }

    finnhub.on("open", () => {
      finnhubOpenedAt = Date.now();
      lastUpstreamDataAt = 0;
      if (config.logConnections) {
        // eslint-disable-next-line no-console
        console.log("Finnhub WS connected.");
      }
      flushFinnhubQueue();
      resubscribeAllSymbols();

      if (config.forceSyntheticTicks) {
        startSyntheticTicks("forceSyntheticTicks=true");
      } else if (config.enableSyntheticTicks) {
        const silentMs =
          Number.isFinite(Number(config.upstreamSilentMs)) && Number(config.upstreamSilentMs) > 0
            ? Number(config.upstreamSilentMs)
            : 15000;
        setTimeout(() => {
          // If upstream never emitted a trade/quote soon after connect, it often means
          // invalid symbols, plan limitations, or an invalid token. Provide a dev fallback.
          if (!finnhub || finnhub.readyState !== WebSocket.OPEN) return;
          if (lastUpstreamDataAt) return;
          if (config.logConnections) {
            // eslint-disable-next-line no-console
            console.warn(
              `Finnhub WS: connected but no trade/quote received after ${silentMs}ms. ` +
                `Set WS_LOG_UPSTREAM_MESSAGES=true to inspect upstream payloads.`
            );
          }
          startSyntheticTicks("upstream silent");
        }, silentMs).unref?.();
      }
    });

    finnhub.on("message", (raw) => {
      const msg = raw.toString();
      try {
        const payload = JSON.parse(msg);
        if (payload?.type === "error") {
          // eslint-disable-next-line no-console
          console.error("Finnhub WS upstream error:", payload);
        }
        if (config.logUpstreamMessages) {
          try {
            // eslint-disable-next-line no-console
            console.log(
              `[Finnhub] ${payload?.type} with ${Array.isArray(payload?.data) ? payload.data.length : 0} items`
            );
          } catch {}
        }
        if (config.logUpstreamSamples) {
          try {
            if (payload?.type === "trade" && Array.isArray(payload.data) && payload.data.length > 0) {
              payload.data.slice(0, 2).forEach((sample) => {
                // eslint-disable-next-line no-console
                console.log(`  [trade] ${sample?.s}: ${sample?.p} @ ${new Date(Number(sample?.t)).toISOString()}`);
              });
            }
            if (payload?.type === "quote" && Array.isArray(payload.data) && payload.data.length > 0) {
              payload.data.slice(0, 2).forEach((sample) => {
                // eslint-disable-next-line no-console
                console.log(`  [quote] ${sample?.s}: bid=${sample?.b} ask=${sample?.a}`);
              });
            }
          } catch {}
        }
        if (Array.isArray(payload?.data)) {
          if (payload.type === "trade") {
            lastUpstreamDataAt = Date.now();
            stopSyntheticTicks();
            payload.data.forEach((item) => {
              recordTrade({
                symbol: item?.s,
                price: Number(item?.p),
                timestampMs: Number(item?.t),
                volume: Number(item?.v)
              });
            });
          }
          if (payload.type === "quote") {
            lastUpstreamDataAt = Date.now();
            stopSyntheticTicks();
            payload.data.forEach((item) => {
              recordQuote({
                symbol: item?.s,
                bid: item?.b,
                ask: item?.a,
                timestampMs: Number(item?.t)
              });
            });
          }
        }
      } catch {}
      const clientCount = wss.clients.size;
      if (config.logUpstreamMessages) {
        try {
          // eslint-disable-next-line no-console
          console.log(`[Finnhub→Relay] sending message to ${clientCount} connected clients`);
        } catch {}
      }
      wss.clients.forEach((ws) => {
        sendRaw(ws, msg);
      });
    });

    finnhub.on("close", () => {
      if (config.logConnections) {
        // eslint-disable-next-line no-console
        console.log("Finnhub WS disconnected. Reconnecting...");
      }
      if (config.enableSyntheticTicks && wss.clients.size > 0) {
        startSyntheticTicks("upstream disconnected");
      }
      scheduleFinnhubReconnect();
    });

    finnhub.on("error", (error) => {
      // eslint-disable-next-line no-console
      console.error("Finnhub WS error:", error.message);
    });
  };

  if (config.finnhubUrl) {
    connectFinnhub();
  } else if (config.logConnections) {
    // eslint-disable-next-line no-console
    console.warn("Finnhub WS disabled. Set FINNHUB_API_KEY/FINNHUB_WS_URL or ALLOW_NO_FINNHUB_WS=true.");
  }

  // Heartbeat ping/pong
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const state = clientState.get(ws);
      const lastPongAt = state?.lastPongAt ?? 0;

      // If too long since last pong -> terminate
      if (Date.now() - lastPongAt > config.clientTimeoutMs) {
        try {
          ws.terminate();
        } catch {}
        return;
      }

      try {
        ws.ping();
      } catch {}
    });
  }, config.pingMs);

  wss.on("connection", (ws, req) => {
    const initialSubscriptions = new Set(defaultSymbols);
    clientState.set(ws, {
      connectedAt: Date.now(),
      lastPongAt: Date.now(),
      subscriptions: initialSubscriptions
    });

    ws.on("pong", () => {
      const state = clientState.get(ws);
      if (state) state.lastPongAt = Date.now();
    });

    ws.on("message", (raw) => {
      // Only ping supported; majors-only symbols are fixed server-side
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        sendJson(ws, { type: "error", ts: nowIso(), message: "Invalid JSON message." });
        return;
      }

      if (msg?.type === "ping") {
        sendJson(ws, { type: "pong", ts: nowIso() });
        return;
      }

      // Unknown message type
      sendJson(ws, { type: "error", ts: nowIso(), message: "Unsupported message type." });
    });

    ws.on("close", () => {
      const state = clientState.get(ws);
      if (!state) return;
      state.subscriptions.forEach((symbol) => {
        const current = symbolCounts.get(symbol) || 0;
        const next = Math.max(0, current - 1);
        if (next === 0 && !alwaysSubscribedSymbols.has(symbol)) {
          symbolCounts.delete(symbol);
          sendToFinnhub({ type: "unsubscribe", symbol });
        } else {
          symbolCounts.set(symbol, next);
        }
      });
    });

    ws.on("error", () => {
      // Avoid crashing the server due to a client socket error
    });

    if (config.logConnections) {
      // eslint-disable-next-line no-console
      console.log(`Client connected. Active: ${wss.clients.size}`);
    }

    // Welcome + initial snapshot
    defaultSymbols.forEach((symbol) => {
      const current = symbolCounts.get(symbol) || 0;
      symbolCounts.set(symbol, current + 1);
      if (current === 0 && !alwaysSubscribedSymbols.has(symbol)) {
        sendToFinnhub({ type: "subscribe", symbol });
      }
    });

    sendJson(ws, {
      type: "welcome",
      ts: nowIso(),
      message: "Connected to Finnhub market stream.",
      path: config.path,
      symbols: defaultSymbols
    });

    ws.on("close", () => {
      if (config.logConnections) {
        // eslint-disable-next-line no-console
        console.log(`Client disconnected. Active: ${wss.clients.size}`);
      }
    });
  });

  // Cleanup on server close (wss "close" event means the WS server was closed)
  wss.on("close", () => {
    clearInterval(pingInterval);
    if (finnhubReconnectTimer) clearTimeout(finnhubReconnectTimer);
    stopSyntheticTicks();
    try {
      finnhub?.close();
    } catch {}
  });

  // Allow caller to close cleanly
  wss.closeGracefully = () => {
    clearInterval(pingInterval);
    if (finnhubReconnectTimer) clearTimeout(finnhubReconnectTimer);
    stopSyntheticTicks();
    try {
      finnhub?.close();
    } catch {}
    try {
      wss.close();
    } catch {}
  };

  return wss;
};

export default initializeSocket;
