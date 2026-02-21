import { WebSocket, WebSocketServer } from "ws";
import { recordQuote, recordTrade, clearLiveRatesCache } from "./marketCache.js";
import { basePrices, supportedSymbols, symbolToPair } from "./marketSymbols.js";
import { getForexMarketStatus, isForexMarketOpen } from "./marketSession.js";

/**
 * Professional WS Market Stream
 * Path: /ws/market
 *
 * Features:
 * - Upstream FCS WebSocket relay
 * - Server-side ping/pong heartbeat (detect dead clients)
 * - Backpressure protection (skip sends if buffer is high)
 * - Clean interval lifecycle
 * - Baseline + ref-counted upstream subscriptions
 */

const DEFAULTS = {
  path: "/ws/market",
  pingMs: 15000, // ping frequency
  clientTimeoutMs: 30000, // terminate if no pong within this window
  maxBufferedBytes: 1_000_000, // ~1MB backpressure threshold
  maxPendingUpstreamMessages: Number(process.env.WS_MAX_PENDING_UPSTREAM_MESSAGES || 1000),
  // Synthetic ticks are permanently disabled: only real upstream WS market data is allowed.
  enableSyntheticTicks: false,
  forceSyntheticTicks: false,
  syntheticTickMs: Number(process.env.MARKET_WS_SYNTHETIC_MS || 1000),
  upstreamSilentMs: Number(process.env.MARKET_WS_UPSTREAM_SILENT_MS || 15000),
  marketHoursEnforced: process.env.MARKET_HOURS_ENFORCED !== "false",
  // In local/dev, allow running without upstream WS to avoid startup crashes.
  allowNoUpstream:
    process.env.ALLOW_NO_FCS_WS === "true" ||
    (process.env.NODE_ENV && process.env.NODE_ENV !== "production"),
  fcsUrl: process.env.FCS_WS_URL || "wss://ws-v4.fcsapi.com/ws",
  // Demo key keeps local/dev startup simple; override with your paid key in env.
  fcsApiKey: process.env.FCS_API_KEY || "fcs_socket_demo",
  fcsTimeframe: String(process.env.FCS_WS_TIMEFRAME || "60"),
  upstreamReconnectMs: Number(
    process.env.MARKET_WS_UPSTREAM_RECONNECT_MS || process.env.FCS_WS_RECONNECT_MS || 5000
  ),
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

const hasAccessKeyInUrl = (url) => /(?:\?|&)access_key=/.test(String(url || ""));

const resolveUpstreamUrl = ({ fcsUrl, fcsApiKey }) => {
  const base = String(fcsUrl || "").trim();
  if (!base) return "";
  if (hasAccessKeyInUrl(base)) return base;
  if (!fcsApiKey) return "";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}access_key=${encodeURIComponent(fcsApiKey)}`;
};

const toTimestampMs = (rawTs) => {
  const ts = Number(rawTs);
  if (!Number.isFinite(ts)) return Date.now();
  if (ts > 1e12) return Math.round(ts);
  if (ts > 1e10) return Math.round(ts);
  return Math.round(ts * 1000);
};

const normalizeFcsPrice = (payload) => {
  if (payload?.type !== "price") return null;

  const symbol = payload?.symbol;
  const prices = payload?.prices || {};
  const price = Number(prices?.c);

  if (!symbol || !Number.isFinite(price)) return null;

  const timestampMs = toTimestampMs(prices?.update ?? prices?.t ?? payload?.timestamp ?? Date.now());

  const volume = Number(prices?.v);
  const bid = Number(prices?.b);
  const ask = Number(prices?.a);

  return {
    symbol,
    price,
    timestampMs,
    volume: Number.isFinite(volume) ? volume : 0,
    bid: Number.isFinite(bid) ? bid : null,
    ask: Number.isFinite(ask) ? ask : null,
    timeframe: String(payload?.timeframe || "")
  };
};

const initializeSocket = ({ server, heartbeatMs, ...opts } = {}) => {
  if (!server) throw new Error("initializeSocket: missing { server }");

  const config = {
    ...DEFAULTS,
    ...opts
  };

  // Backward compatibility: heartbeatMs retained.
  if (Number.isFinite(Number(heartbeatMs)) && Number(heartbeatMs) > 0) {
    config.pingMs = Number(heartbeatMs);
  }

  config.upstreamUrl = resolveUpstreamUrl({ fcsUrl: config.fcsUrl, fcsApiKey: config.fcsApiKey });

  if (!config.upstreamUrl && !config.allowNoUpstream) {
    throw new Error("initializeSocket: missing FCS_API_KEY or FCS_WS_URL with access_key");
  }

  const wss = new WebSocketServer({ server, path: config.path });
  const getMarketStatus = () => getForexMarketStatus(new Date());
  const isMarketOpenNow = () =>
    config.marketHoursEnforced ? isForexMarketOpen(new Date()) : true;

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
    if (!isMarketOpenNow()) return;
    if (syntheticTimer) return;

    const tickMs = Number.isFinite(Number(config.syntheticTickMs)) && Number(config.syntheticTickMs) > 0
      ? Number(config.syntheticTickMs)
      : 1000;

    if (config.logConnections) {
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
      console.warn("Market WS: stopped synthetic ticks (upstream resumed).");
    }
  };

  // Upstream FCS connection
  let upstream = null;
  let upstreamReconnectTimer = null;
  let lastUpstreamDataAt = 0;

  const pendingUpstreamMessages = [];
  const maxPendingUpstreamMessages =
    Number.isFinite(Number(config.maxPendingUpstreamMessages)) && Number(config.maxPendingUpstreamMessages) > 0
      ? Number(config.maxPendingUpstreamMessages)
      : 1000;
  let warnedPendingQueueOverflow = false;

  const enqueueUpstreamPayload = (payload) => {
    pendingUpstreamMessages.push(payload);
    if (pendingUpstreamMessages.length > maxPendingUpstreamMessages) {
      // Drop oldest to prevent unbounded memory growth during upstream outages.
      pendingUpstreamMessages.splice(0, pendingUpstreamMessages.length - maxPendingUpstreamMessages);
      if (!warnedPendingQueueOverflow && config.logUpstreamMessages) {
        warnedPendingQueueOverflow = true;
        console.warn(
          `Upstream WS: pending message queue overflow (capped at ${maxPendingUpstreamMessages}). Dropping oldest messages.`
        );
      }
    }
  };

  const flushUpstreamQueue = () => {
    if (!upstream || upstream.readyState !== WebSocket.OPEN) return;
    while (pendingUpstreamMessages.length > 0) {
      const payload = pendingUpstreamMessages.shift();
      try {
        upstream.send(payload);
      } catch {
        break;
      }
    }
  };

  const sendToUpstream = (messageObj) => {
    if (!config.upstreamUrl) return;

    const payload = safeJson(messageObj);
    if (!upstream || upstream.readyState !== WebSocket.OPEN) {
      enqueueUpstreamPayload(payload);
      return;
    }

    try {
      upstream.send(payload);
    } catch {
      enqueueUpstreamPayload(payload);
    }
  };

  const joinSymbolUpstream = (symbol) => {
    sendToUpstream({ type: "join_symbol", symbol, timeframe: config.fcsTimeframe });
  };

  const leaveSymbolUpstream = (symbol) => {
    sendToUpstream({ type: "leave_symbol", symbol, timeframe: config.fcsTimeframe });
  };

  const resubscribeAllSymbols = () => {
    if (!config.upstreamUrl) return;

    alwaysSubscribedSymbols.forEach((symbol) => {
      joinSymbolUpstream(symbol);
    });

    symbolCounts.forEach((count, symbol) => {
      if (count > 0 && !alwaysSubscribedSymbols.has(symbol)) {
        joinSymbolUpstream(symbol);
      }
    });
  };

  const scheduleUpstreamReconnect = () => {
    if (!config.upstreamUrl) return;
    if (upstreamReconnectTimer) return;

    upstreamReconnectTimer = setTimeout(() => {
      upstreamReconnectTimer = null;
      connectUpstream();
    }, config.upstreamReconnectMs);
  };

  const connectUpstream = () => {
    if (!config.upstreamUrl) return;

    try {
      upstream = new WebSocket(config.upstreamUrl);
    } catch (error) {
      console.error("Failed to create FCS upstream WS:", error.message);
      scheduleUpstreamReconnect();
      return;
    }

    upstream.on("open", () => {
      lastUpstreamDataAt = 0;

      if (config.logConnections) {
        console.log("FCS upstream WS connected.");
      }

      flushUpstreamQueue();
      resubscribeAllSymbols();

      if (config.forceSyntheticTicks) {
        startSyntheticTicks("forceSyntheticTicks=true");
      } else if (config.enableSyntheticTicks) {
        const silentMs =
          Number.isFinite(Number(config.upstreamSilentMs)) && Number(config.upstreamSilentMs) > 0
            ? Number(config.upstreamSilentMs)
            : 15000;

        setTimeout(() => {
          // If upstream never emits prices soon after connect, it often means
          // invalid symbols, plan limitations, or invalid credentials.
          if (!upstream || upstream.readyState !== WebSocket.OPEN) return;
          if (lastUpstreamDataAt) return;

          if (config.logConnections) {
            console.warn(
              `FCS upstream WS: connected but no prices received after ${silentMs}ms. ` +
                `Set WS_LOG_UPSTREAM_MESSAGES=true to inspect payloads.`
            );
          }

          startSyntheticTicks("upstream silent");
        }, silentMs).unref?.();
      }
    });

    upstream.on("message", (raw) => {
      let payload;
      try {
        payload = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (payload?.type === "error") {
        console.error("FCS upstream error:", payload);
      }

      if (config.logUpstreamMessages) {
        try {
          console.log(`[FCS] ${payload?.type} ${payload?.symbol || ""}`.trim());
        } catch {}
      }

      const normalized = normalizeFcsPrice(payload);
      if (normalized) {
        if (config.marketHoursEnforced && !isForexMarketOpen(new Date(normalized.timestampMs))) {
          stopSyntheticTicks();
          return;
        }

        lastUpstreamDataAt = Date.now();
        stopSyntheticTicks();

        recordTrade({
          symbol: normalized.symbol,
          price: normalized.price,
          timestampMs: normalized.timestampMs,
          volume: normalized.volume
        });

        if (Number.isFinite(normalized.bid) && Number.isFinite(normalized.ask)) {
          recordQuote({
            symbol: normalized.symbol,
            bid: normalized.bid,
            ask: normalized.ask,
            timestampMs: normalized.timestampMs
          });
        }

        const relayPayload = safeJson({
          type: "trade",
          data: [
            {
              s: normalized.symbol,
              p: normalized.price,
              t: normalized.timestampMs,
              v: normalized.volume
            }
          ]
        });

        if (config.logUpstreamSamples) {
          try {
            console.log(
              `[price] ${normalized.symbol}: ${normalized.price} @ ${new Date(normalized.timestampMs).toISOString()}`
            );
          } catch {}
        }

        wss.clients.forEach((ws) => {
          sendRaw(ws, relayPayload);
        });

        return;
      }

      // Relay upstream status/error frames as-is for diagnostics.
      if (payload?.type === "welcome" || payload?.type === "message" || payload?.type === "error") {
        const msg = safeJson(payload);
        wss.clients.forEach((ws) => {
          sendRaw(ws, msg);
        });
      }
    });

    upstream.on("close", () => {
      if (config.logConnections) {
        console.log("FCS upstream WS disconnected. Reconnecting...");
      }

      if (config.enableSyntheticTicks && isMarketOpenNow() && wss.clients.size > 0) {
        startSyntheticTicks("upstream disconnected");
      }

      scheduleUpstreamReconnect();
    });

    upstream.on("error", (error) => {
      console.error("FCS upstream WS error:", error.message);
    });
  };

  if (config.upstreamUrl) {
    connectUpstream();
  } else if (config.logConnections) {
    console.warn("FCS upstream WS disabled. Set FCS_API_KEY/FCS_WS_URL or ALLOW_NO_FCS_WS=true.");
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

  let previousMarketOpen = isMarketOpenNow();
  const marketStatusInterval = setInterval(() => {
    const status = getMarketStatus();
    const marketOpen = config.marketHoursEnforced ? status.isOpen : true;

    if (!marketOpen) {
      stopSyntheticTicks();
    }

    if (marketOpen === previousMarketOpen) return;

    if (marketOpen && !previousMarketOpen) {
      // Start a fresh session from real opening ticks only.
      clearLiveRatesCache();

      if (!upstream || upstream.readyState === WebSocket.CLOSED || upstream.readyState === WebSocket.CLOSING) {
        connectUpstream();
      } else if (upstream.readyState === WebSocket.OPEN) {
        resubscribeAllSymbols();
      }
    }

    previousMarketOpen = marketOpen;

    const payload = safeJson({
      type: "marketStatus",
      data: {
        ...status,
        enforced: config.marketHoursEnforced
      }
    });

    wss.clients.forEach((ws) => {
      sendRaw(ws, payload);
    });
  }, 30_000);

  wss.on("connection", (ws) => {
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
      // Only ping supported; symbol subscriptions are managed server-side.
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
          leaveSymbolUpstream(symbol);
        } else {
          symbolCounts.set(symbol, next);
        }
      });
    });

    ws.on("error", () => {
      // Avoid crashing the server due to a client socket error
    });

    if (config.logConnections) {
      console.log(`Client connected. Active: ${wss.clients.size}`);
    }

    // Welcome + initial snapshot
    defaultSymbols.forEach((symbol) => {
      const current = symbolCounts.get(symbol) || 0;
      symbolCounts.set(symbol, current + 1);
      if (current === 0 && !alwaysSubscribedSymbols.has(symbol)) {
        joinSymbolUpstream(symbol);
      }
    });

    sendJson(ws, {
      type: "welcome",
      ts: nowIso(),
      message: "Connected to FCS market stream.",
      path: config.path,
      symbols: defaultSymbols,
      timeframe: config.fcsTimeframe,
      market: {
        ...getMarketStatus(),
        enforced: config.marketHoursEnforced
      }
    });

    ws.on("close", () => {
      if (config.logConnections) {
        console.log(`Client disconnected. Active: ${wss.clients.size}`);
      }
    });
  });

  // Cleanup on server close (wss "close" event means the WS server was closed)
  wss.on("close", () => {
    clearInterval(pingInterval);
    clearInterval(marketStatusInterval);
    if (upstreamReconnectTimer) clearTimeout(upstreamReconnectTimer);
    stopSyntheticTicks();
    try {
      upstream?.close();
    } catch {}
  });

  // Allow caller to close cleanly
  wss.closeGracefully = () => {
    clearInterval(pingInterval);
    clearInterval(marketStatusInterval);
    if (upstreamReconnectTimer) clearTimeout(upstreamReconnectTimer);
    stopSyntheticTicks();
    try {
      upstream?.close();
    } catch {}
    try {
      wss.close();
    } catch {}
  };

  return wss;
};

export default initializeSocket;
