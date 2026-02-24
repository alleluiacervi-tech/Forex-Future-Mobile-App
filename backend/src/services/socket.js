import { WebSocket, WebSocketServer } from "ws";
import Logger from "../utils/logger.js";
import { clearLiveRatesCache, recordQuote, recordTrade } from "./marketCache.js";
import { publishMarketStream, subscribeMarketAlerts, subscribeMarketStream } from "./marketPubSub.js";
import { basePrices, supportedSymbols, symbolToPair } from "./marketSymbols.js";
import { getForexMarketStatus, isForexMarketOpen } from "./marketSession.js";

const logger = new Logger("MarketSocket");

/**
 * Professional WS Market Stream
 * Path: /ws/market
 *
 * Features:
 * - Upstream FCS WebSocket relay
 * - Circuit breaker around upstream connectivity
 * - Server-side ping/pong heartbeat (detect dead clients)
 * - Backpressure protection (skip sends if buffer is high)
 * - Redis-backed pub/sub fan-out for high client concurrency
 * - Baseline + ref-counted upstream subscriptions
 */

const DEFAULTS = {
  path: "/ws/market",
  pingMs: 15000,
  clientTimeoutMs: 30000,
  maxBufferedBytes: 1_000_000,
  maxPendingUpstreamMessages: Number(process.env.WS_MAX_PENDING_UPSTREAM_MESSAGES || 1000),
  enableSyntheticTicks: false,
  forceSyntheticTicks: false,
  syntheticTickMs: Number(process.env.MARKET_WS_SYNTHETIC_MS || 1000),
  upstreamSilentMs: Number(process.env.MARKET_WS_UPSTREAM_SILENT_MS || 15000),
  marketHoursEnforced: process.env.MARKET_HOURS_ENFORCED !== "false",
  allowNoUpstream:
    process.env.ALLOW_NO_FCS_WS === "true" ||
    (process.env.NODE_ENV && process.env.NODE_ENV !== "production"),
  fcsUrl: process.env.FCS_WS_URL || "wss://ws-v4.fcsapi.com/ws",
  fcsApiKey: process.env.FCS_API_KEY || "fcs_socket_demo",
  fcsTimeframe: String(process.env.FCS_WS_TIMEFRAME || "60"),
  upstreamHeartbeatMs: Number(process.env.FCS_WS_HEARTBEAT_MS || 25000),
  upstreamReconnectMs: Number(
    process.env.MARKET_WS_UPSTREAM_RECONNECT_MS || process.env.FCS_WS_RECONNECT_MS || 5000
  ),
  breakerFailureThreshold: Number(process.env.MARKET_WS_BREAKER_FAILURE_THRESHOLD || 4),
  breakerCooldownMs: Number(process.env.MARKET_WS_BREAKER_COOLDOWN_MS || 15000),
  breakerMaxCooldownMs: Number(process.env.MARKET_WS_BREAKER_MAX_COOLDOWN_MS || 120000),
  breakerHalfOpenSuccesses: Number(process.env.MARKET_WS_BREAKER_HALF_OPEN_SUCCESSES || 1),
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

const createCircuitBreaker = ({
  failureThreshold,
  cooldownMs,
  maxCooldownMs,
  halfOpenSuccesses
}) => {
  const settings = {
    failureThreshold: Math.max(1, Number(failureThreshold) || 4),
    cooldownMs: Math.max(1000, Number(cooldownMs) || 15000),
    maxCooldownMs: Math.max(2000, Number(maxCooldownMs) || 120000),
    halfOpenSuccesses: Math.max(1, Number(halfOpenSuccesses) || 1)
  };

  const state = {
    status: "CLOSED",
    failures: 0,
    openedAt: 0,
    currentCooldownMs: settings.cooldownMs,
    halfOpenPasses: 0
  };

  const open = () => {
    state.status = "OPEN";
    state.openedAt = Date.now();
    state.halfOpenPasses = 0;
    state.currentCooldownMs = Math.min(state.currentCooldownMs * 2, settings.maxCooldownMs);
  };

  return {
    canRequest() {
      if (state.status === "CLOSED") return true;
      if (state.status === "HALF_OPEN") return true;

      const elapsed = Date.now() - state.openedAt;
      if (elapsed >= state.currentCooldownMs) {
        state.status = "HALF_OPEN";
        state.halfOpenPasses = 0;
        return true;
      }

      return false;
    },

    markSuccess() {
      if (state.status === "HALF_OPEN") {
        state.halfOpenPasses += 1;
        if (state.halfOpenPasses >= settings.halfOpenSuccesses) {
          state.status = "CLOSED";
          state.failures = 0;
          state.currentCooldownMs = settings.cooldownMs;
          state.halfOpenPasses = 0;
        }
        return;
      }

      state.failures = 0;
      if (state.status === "OPEN") {
        state.status = "CLOSED";
        state.currentCooldownMs = settings.cooldownMs;
      }
    },

    markFailure() {
      state.failures += 1;

      if (state.status === "HALF_OPEN") {
        open();
        return;
      }

      if (state.failures >= settings.failureThreshold) {
        open();
      }
    },

    nextDelayMs(baseDelayMs) {
      const defaultDelay = Math.max(250, Number(baseDelayMs) || 1000);
      if (state.status !== "OPEN") return defaultDelay;

      const remaining = state.currentCooldownMs - (Date.now() - state.openedAt);
      return Math.max(defaultDelay, Math.max(0, remaining));
    },

    snapshot() {
      return {
        status: state.status,
        failures: state.failures,
        cooldownMs: state.currentCooldownMs,
        openedAt: state.openedAt || null
      };
    }
  };
};

const initializeSocket = ({ server, heartbeatMs, ...opts } = {}) => {
  if (!server) throw new Error("initializeSocket: missing { server }");

  const config = {
    ...DEFAULTS,
    ...opts
  };

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

  const clientState = new WeakMap();
  const connectedClients = new Set();
  const symbolCounts = new Map();
  const defaultSymbols = supportedSymbols;
  const alwaysSubscribedSymbols = new Set(defaultSymbols);

  const sendJson = (ws, messageObj) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > config.maxBufferedBytes) return;
    ws.send(safeJson(messageObj));
  };

  const sendRaw = (ws, rawMessage) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > config.maxBufferedBytes) return;
    ws.send(rawMessage);
  };

  let broadcastQueue = [];
  let broadcastScheduled = false;

  const flushBroadcastQueue = () => {
    broadcastScheduled = false;
    if (broadcastQueue.length === 0) return;

    const batch = broadcastQueue;
    broadcastQueue = [];

    for (const raw of batch) {
      for (const ws of connectedClients) {
        sendRaw(ws, raw);
      }
    }
  };

  const enqueueBroadcast = (payload) => {
    const raw = typeof payload === "string" ? payload : safeJson(payload);
    broadcastQueue.push(raw);

    if (!broadcastScheduled) {
      broadcastScheduled = true;
      setImmediate(flushBroadcastQueue);
    }
  };

  const processTradeFrame = (frame) => {
    if (!frame || frame.type !== "trade" || !Array.isArray(frame.data)) return;

    frame.data.forEach((entry) => {
      const symbol = entry?.s;
      const pair = symbolToPair[symbol];
      const price = Number(entry?.p);
      const timestampMs = Number(entry?.t);
      const volume = Number(entry?.v);
      const bid = Number(entry?.b);
      const ask = Number(entry?.a);

      if (!pair || !Number.isFinite(price)) return;

      recordTrade({
        symbol,
        price,
        timestampMs: Number.isFinite(timestampMs) ? timestampMs : Date.now(),
        volume: Number.isFinite(volume) ? volume : 0,
        bid: Number.isFinite(bid) ? bid : null,
        ask: Number.isFinite(ask) ? ask : null
      });

      if (Number.isFinite(bid) && Number.isFinite(ask)) {
        recordQuote({
          symbol,
          bid,
          ask,
          timestampMs: Number.isFinite(timestampMs) ? timestampMs : Date.now()
        });
      }
    });
  };

  const unsubscribeStream = subscribeMarketStream((payload) => {
    processTradeFrame(payload);
    enqueueBroadcast(payload);
  });

  const unsubscribeAlerts = subscribeMarketAlerts((alert) => {
    enqueueBroadcast({ type: "marketAlert", data: alert });
  });

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
      logger.warn("Starting synthetic market ticks", { reason: reason || "fallback", tickMs });
    }

    syntheticTimer = setInterval(() => {
      const ts = Date.now();
      supportedSymbols.forEach((symbol) => {
        const price = nextSyntheticPrice(symbol);
        if (!Number.isFinite(price)) return;

        publishMarketStream({
          type: "trade",
          data: [{ s: symbol, p: price, t: ts, v: 0 }]
        });
      });
    }, tickMs);
  };

  const stopSyntheticTicks = () => {
    if (!syntheticTimer) return;
    clearInterval(syntheticTimer);
    syntheticTimer = null;
    if (config.logConnections) {
      logger.info("Stopped synthetic market ticks");
    }
  };

  let upstream = null;
  let upstreamReconnectTimer = null;
  let upstreamHeartbeatTimer = null;
  let lastUpstreamDataAt = 0;
  let isShuttingDown = false;

  const circuitBreaker = createCircuitBreaker({
    failureThreshold: config.breakerFailureThreshold,
    cooldownMs: config.breakerCooldownMs,
    maxCooldownMs: config.breakerMaxCooldownMs,
    halfOpenSuccesses: config.breakerHalfOpenSuccesses
  });

  const pendingUpstreamMessages = [];
  const maxPendingUpstreamMessages =
    Number.isFinite(Number(config.maxPendingUpstreamMessages)) && Number(config.maxPendingUpstreamMessages) > 0
      ? Number(config.maxPendingUpstreamMessages)
      : 1000;

  let warnedPendingQueueOverflow = false;

  const enqueueUpstreamPayload = (payload) => {
    pendingUpstreamMessages.push(payload);
    if (pendingUpstreamMessages.length > maxPendingUpstreamMessages) {
      pendingUpstreamMessages.splice(0, pendingUpstreamMessages.length - maxPendingUpstreamMessages);
      if (!warnedPendingQueueOverflow && config.logUpstreamMessages) {
        warnedPendingQueueOverflow = true;
        logger.warn("Upstream payload queue overflow", {
          maxPendingUpstreamMessages
        });
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

  const scheduleUpstreamReconnect = (reason = "retry") => {
    if (!config.upstreamUrl || isShuttingDown) return;
    if (upstreamReconnectTimer) return;

    const delayMs = circuitBreaker.nextDelayMs(config.upstreamReconnectMs);

    upstreamReconnectTimer = setTimeout(() => {
      upstreamReconnectTimer = null;
      connectUpstream("scheduled");
    }, delayMs);

    upstreamReconnectTimer.unref?.();

    logger.warn("Scheduled upstream reconnect", {
      reason,
      delayMs,
      breaker: circuitBreaker.snapshot()
    });
  };

  const stopUpstreamHeartbeat = () => {
    if (!upstreamHeartbeatTimer) return;
    clearInterval(upstreamHeartbeatTimer);
    upstreamHeartbeatTimer = null;
  };

  const startUpstreamHeartbeat = () => {
    const intervalMs =
      Number.isFinite(Number(config.upstreamHeartbeatMs)) && Number(config.upstreamHeartbeatMs) > 0
        ? Number(config.upstreamHeartbeatMs)
        : 25000;

    stopUpstreamHeartbeat();
    upstreamHeartbeatTimer = setInterval(() => {
      if (!upstream || upstream.readyState !== WebSocket.OPEN) return;

      try {
        upstream.ping();
      } catch {}

      try {
        upstream.send(
          safeJson({
            type: "ping",
            timestamp: Date.now()
          })
        );
      } catch {}
    }, intervalMs);

    upstreamHeartbeatTimer.unref?.();
  };

  const connectUpstream = (trigger = "manual") => {
    if (!config.upstreamUrl || isShuttingDown) return;
    if (upstream && (upstream.readyState === WebSocket.CONNECTING || upstream.readyState === WebSocket.OPEN)) {
      return;
    }

    if (!circuitBreaker.canRequest()) {
      scheduleUpstreamReconnect("circuit-open");
      return;
    }

    stopUpstreamHeartbeat();

    let failed = false;

    try {
      upstream = new WebSocket(config.upstreamUrl);
    } catch (error) {
      failed = true;
      circuitBreaker.markFailure();
      logger.error("Failed to create upstream WebSocket", {
        trigger,
        error: error?.message,
        breaker: circuitBreaker.snapshot()
      });
      scheduleUpstreamReconnect("constructor-error");
      return;
    }

    const markFailure = (event, error) => {
      if (failed) return;
      failed = true;
      circuitBreaker.markFailure();
      logger.warn("Upstream connection failure", {
        event,
        error: error?.message,
        breaker: circuitBreaker.snapshot()
      });
    };

    upstream.on("open", () => {
      lastUpstreamDataAt = 0;
      circuitBreaker.markSuccess();

      if (config.logConnections) {
        logger.info("FCS upstream connected", {
          trigger,
          breaker: circuitBreaker.snapshot()
        });
      }

      startUpstreamHeartbeat();
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
          if (!upstream || upstream.readyState !== WebSocket.OPEN) return;
          if (lastUpstreamDataAt) return;

          if (config.logConnections) {
            logger.warn("FCS upstream connected but no price frames received", {
              silentMs
            });
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
        logger.warn("FCS upstream payload error", { payload });
      }

      if (payload?.type === "ping") {
        try {
          upstream?.send(
            safeJson({
              type: "pong",
              timestamp: Date.now()
            })
          );
        } catch {}
        return;
      }

      if (config.logUpstreamMessages) {
        logger.debug("FCS upstream frame", {
          type: payload?.type,
          symbol: payload?.symbol
        });
      }

      const normalized = normalizeFcsPrice(payload);
      if (normalized) {
        if (config.marketHoursEnforced && !isForexMarketOpen(new Date(normalized.timestampMs))) {
          stopSyntheticTicks();
          return;
        }

        lastUpstreamDataAt = Date.now();
        stopSyntheticTicks();

        publishMarketStream({
          type: "trade",
          data: [
            {
              s: normalized.symbol,
              p: normalized.price,
              t: normalized.timestampMs,
              v: normalized.volume,
              b: normalized.bid,
              a: normalized.ask
            }
          ]
        });

        if (config.logUpstreamSamples) {
          logger.debug("Normalized upstream price", {
            symbol: normalized.symbol,
            price: normalized.price,
            timestamp: new Date(normalized.timestampMs).toISOString()
          });
        }

        return;
      }

      if (payload?.type === "welcome" || payload?.type === "message" || payload?.type === "error") {
        publishMarketStream(payload);
      }
    });

    upstream.on("close", (code, reasonBuffer) => {
      stopUpstreamHeartbeat();
      const reason = Buffer.isBuffer(reasonBuffer) ? reasonBuffer.toString("utf8") : String(reasonBuffer || "");

      if (config.logConnections) {
        logger.warn("FCS upstream disconnected", { code, reason });
      }

      markFailure("close", new Error(`upstream closed (${code})`));

      if (config.enableSyntheticTicks && isMarketOpenNow() && connectedClients.size > 0) {
        startSyntheticTicks("upstream disconnected");
      }

      scheduleUpstreamReconnect("close");
    });

    upstream.on("error", (error) => {
      stopUpstreamHeartbeat();
      markFailure("error", error);
    });
  };

  if (config.upstreamUrl) {
    connectUpstream("startup");
  } else if (config.logConnections) {
    logger.warn("FCS upstream disabled. Set FCS_API_KEY/FCS_WS_URL or ALLOW_NO_FCS_WS=true.");
  }

  const pingInterval = setInterval(() => {
    connectedClients.forEach((ws) => {
      const state = clientState.get(ws);
      const lastPongAt = state?.lastPongAt ?? 0;

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
      clearLiveRatesCache();

      if (!upstream || upstream.readyState === WebSocket.CLOSED || upstream.readyState === WebSocket.CLOSING) {
        connectUpstream("market-open");
      } else if (upstream.readyState === WebSocket.OPEN) {
        resubscribeAllSymbols();
      }
    }

    previousMarketOpen = marketOpen;

    publishMarketStream({
      type: "marketStatus",
      data: {
        ...status,
        enforced: config.marketHoursEnforced
      }
    });
  }, 30_000);

  wss.on("connection", (ws) => {
    connectedClients.add(ws);

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

      sendJson(ws, { type: "error", ts: nowIso(), message: "Unsupported message type." });
    });

    ws.on("close", () => {
      connectedClients.delete(ws);

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

      if (config.logConnections) {
        logger.info("Market client disconnected", { activeClients: connectedClients.size });
      }
    });

    ws.on("error", () => {
      connectedClients.delete(ws);
    });

    if (config.logConnections) {
      logger.info("Market client connected", { activeClients: connectedClients.size });
    }

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
  });

  const cleanup = () => {
    isShuttingDown = true;
    clearInterval(pingInterval);
    clearInterval(marketStatusInterval);
    if (upstreamReconnectTimer) clearTimeout(upstreamReconnectTimer);
    stopUpstreamHeartbeat();
    stopSyntheticTicks();
    unsubscribeStream();
    unsubscribeAlerts();

    try {
      upstream?.close();
    } catch {}
  };

  wss.on("close", cleanup);

  wss.closeGracefully = () => {
    cleanup();
    try {
      wss.close();
    } catch {}
  };

  wss.publish = (payload) => {
    publishMarketStream(payload);
  };

  return wss;
};

export default initializeSocket;
