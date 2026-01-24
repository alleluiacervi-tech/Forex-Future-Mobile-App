import { WebSocket, WebSocketServer } from "ws";
import { recordQuote, recordTrade } from "./marketCache.js";
import { supportedSymbols } from "./marketSymbols.js";

/**
 * Professional WS Market Stream
 * Path: /ws/market
 *
 * Features:
 * - Upstream Finnhub WS relay
 * - Server-side ping/pong heartbeat (detect dead clients)
 * - Backpressure protection (skip sends if buffer is high)
 * - Clean interval lifecycle
 * - Subscribe/unsubscribe handling with symbol ref-counting
 */

const DEFAULTS = {
  path: "/ws/market",
  pingMs: 15000,              // ping frequency
  clientTimeoutMs: 30000,     // terminate if no pong within this window
  maxBufferedBytes: 1_000_000, // ~1MB backpressure threshold
  finnhubUrl:
    process.env.FINNHUB_WS_URL ||
    (process.env.FINNHUB_API_KEY
      ? `wss://ws.finnhub.io?token=${process.env.FINNHUB_API_KEY}`
      : ""),
  finnhubReconnectMs: 5000,
  logConnections: true
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

  if (!config.finnhubUrl) {
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

  // Upstream Finnhub connection
  let finnhub = null;
  let finnhubReconnectTimer = null;
  const pendingFinnhubMessages = [];

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
    const payload = safeJson(messageObj);
    if (!finnhub || finnhub.readyState !== WebSocket.OPEN) {
      pendingFinnhubMessages.push(payload);
      return;
    }
    try {
      finnhub.send(payload);
    } catch {
      pendingFinnhubMessages.push(payload);
    }
  };

  const resubscribeAllSymbols = () => {
    alwaysSubscribedSymbols.forEach((symbol) => {
      sendToFinnhub({ type: "subscribe", symbol });
    });
    symbolCounts.forEach((count, symbol) => {
      if (count > 0) sendToFinnhub({ type: "subscribe", symbol });
    });
  };

  const scheduleFinnhubReconnect = () => {
    if (finnhubReconnectTimer) return;
    finnhubReconnectTimer = setTimeout(() => {
      finnhubReconnectTimer = null;
      connectFinnhub();
    }, config.finnhubReconnectMs);
  };

  const connectFinnhub = () => {
    try {
      finnhub = new WebSocket(config.finnhubUrl);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create Finnhub WS:", error.message);
      scheduleFinnhubReconnect();
      return;
    }

    finnhub.on("open", () => {
      if (config.logConnections) {
        // eslint-disable-next-line no-console
        console.log("Finnhub WS connected.");
      }
      flushFinnhubQueue();
      resubscribeAllSymbols();
    });

    finnhub.on("message", (raw) => {
      const msg = raw.toString();
      try {
        const payload = JSON.parse(msg);
        // Debug: log incoming payload summary to help diagnose missing updates
        try {
          // eslint-disable-next-line no-console
          console.log("Finnhub message:", payload?.type, Array.isArray(payload?.data) ? payload.data.length : 0);
        } catch {}
        // Additional debug: log a sample symbol/price from the payload
        try {
          if (payload?.type === "trade" && Array.isArray(payload.data) && payload.data.length > 0) {
            const sample = payload.data[0];
            // eslint-disable-next-line no-console
            console.log("Finnhub sample trade:", sample?.s, sample?.p, sample?.t);
          }
          if (payload?.type === "quote" && Array.isArray(payload.data) && payload.data.length > 0) {
            const sample = payload.data[0];
            // eslint-disable-next-line no-console
            console.log("Finnhub sample quote:", sample?.s, sample?.b, sample?.a, sample?.t);
          }
        } catch {}
        if (Array.isArray(payload?.data)) {
          if (payload.type === "trade") {
            payload.data.forEach((item) => {
              recordTrade({
                symbol: item?.s,
                price: Number(item?.p),
                timestampMs: Number(item?.t)
              });
            });
          }
          if (payload.type === "quote") {
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
      wss.clients.forEach((ws) => {
        sendRaw(ws, msg);
      });
    });

    finnhub.on("close", () => {
      if (config.logConnections) {
        // eslint-disable-next-line no-console
        console.log("Finnhub WS disconnected. Reconnecting...");
      }
      scheduleFinnhubReconnect();
    });

    finnhub.on("error", (error) => {
      // eslint-disable-next-line no-console
      console.error("Finnhub WS error:", error.message);
    });
  };

  connectFinnhub();

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
      if (current === 0) sendToFinnhub({ type: "subscribe", symbol });
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
    try {
      finnhub?.close();
    } catch {}
  });

  // Allow caller to close cleanly
  wss.closeGracefully = () => {
    clearInterval(pingInterval);
    if (finnhubReconnectTimer) clearTimeout(finnhubReconnectTimer);
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
