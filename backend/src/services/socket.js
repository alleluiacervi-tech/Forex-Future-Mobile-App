import { WebSocket, WebSocketServer } from "ws";
import { getLiveRates } from "./rates.js";

/**
 * Professional WS Market Stream
 * Path: /ws/market
 *
 * Features:
 * - Server-side ping/pong heartbeat (detect dead clients)
 * - Backpressure protection (skip sends if buffer is high)
 * - Clean interval lifecycle
 * - Optional subscribe/unsubscribe handling
 */

const DEFAULTS = {
  path: "/ws/market",
  broadcastMs: 1000,          // how often to broadcast rates
  pingMs: 15000,              // ping frequency
  clientTimeoutMs: 30000,     // terminate if no pong within this window
  maxBufferedBytes: 1_000_000 // ~1MB backpressure threshold
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

  // Backward compatibility: heartbeatMs = broadcast interval
  if (Number.isFinite(Number(heartbeatMs)) && Number(heartbeatMs) > 0) {
    config.broadcastMs = Number(heartbeatMs);
  }

  const wss = new WebSocketServer({ server, path: config.path });

  // Track subscriptions (future-proof). Default: subscribed to rates.
  const clientState = new WeakMap();

  const send = (ws, messageObj) => {
    if (ws.readyState !== WebSocket.OPEN) return;

    // Backpressure guard: if client is slow, skip sending to avoid memory buildup
    if (ws.bufferedAmount > config.maxBufferedBytes) return;

    ws.send(safeJson(messageObj));
  };

  const buildRatesMessage = async () => ({
    type: "rates",
    ts: nowIso(),
    data: await getLiveRates()
  });

  // Broadcast loop
  let broadcasting = false;

  const broadcastRates = async () => {
    if (broadcasting) return;
    broadcasting = true;
    let msg;
    try {
      msg = safeJson(await buildRatesMessage());
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to build rates message:", error.message);
      broadcasting = false;
      return;
    }

    wss.clients.forEach((ws) => {
      if (ws.readyState !== WebSocket.OPEN) return;

      // Backpressure guard
      if (ws.bufferedAmount > config.maxBufferedBytes) return;

      const state = clientState.get(ws);
      const subscribed = state?.subscriptions?.has("rates") ?? true;
      if (!subscribed) return;

      ws.send(msg);
    });
    broadcasting = false;
  };

  const broadcastInterval = setInterval(() => {
    void broadcastRates();
  }, config.broadcastMs);

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
    clientState.set(ws, {
      connectedAt: Date.now(),
      lastPongAt: Date.now(),
      subscriptions: new Set(["rates"])
    });

    ws.on("pong", () => {
      const state = clientState.get(ws);
      if (state) state.lastPongAt = Date.now();
    });

    ws.on("message", (raw) => {
      // Optional: handle subscribe/unsubscribe messages
      // Example: { "type": "subscribe", "channel": "rates" }
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        send(ws, { type: "error", ts: nowIso(), message: "Invalid JSON message." });
        return;
      }

      const state = clientState.get(ws);
      if (!state) return;

      if (msg?.type === "subscribe" && msg?.channel) {
        state.subscriptions.add(String(msg.channel));
        send(ws, { type: "subscribed", ts: nowIso(), channel: String(msg.channel) });
        if (msg.channel === "rates") {
          void (async () => {
            try {
              send(ws, await buildRatesMessage());
            } catch (error) {
              send(ws, { type: "error", ts: nowIso(), message: error.message });
            }
          })();
        }
        return;
      }

      if (msg?.type === "unsubscribe" && msg?.channel) {
        state.subscriptions.delete(String(msg.channel));
        send(ws, { type: "unsubscribed", ts: nowIso(), channel: String(msg.channel) });
        return;
      }

      if (msg?.type === "ping") {
        send(ws, { type: "pong", ts: nowIso() });
        return;
      }

      // Unknown message type
      send(ws, { type: "error", ts: nowIso(), message: "Unsupported message type." });
    });

    ws.on("close", () => {
      // WeakMap cleans itself; nothing needed
    });

    ws.on("error", () => {
      // Avoid crashing the server due to a client socket error
    });

    // Welcome + initial snapshot
    send(ws, {
      type: "welcome",
      ts: nowIso(),
      message: "Connected to live market stream.",
      path: config.path
    });

    void (async () => {
      try {
        send(ws, await buildRatesMessage());
      } catch (error) {
        send(ws, { type: "error", ts: nowIso(), message: error.message });
      }
    })();
  });

  // Cleanup on server close (wss "close" event means the WS server was closed)
  wss.on("close", () => {
    clearInterval(broadcastInterval);
    clearInterval(pingInterval);
  });

  // Allow caller to close cleanly
  wss.closeGracefully = () => {
    clearInterval(broadcastInterval);
    clearInterval(pingInterval);
    try {
      wss.close();
    } catch {}
  };

  return wss;
};

export default initializeSocket;
