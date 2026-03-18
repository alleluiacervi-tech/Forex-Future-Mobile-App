import { APP_CONFIG } from '../config';

export type MarketSocketEvent = {
  type: string;
  [key: string]: unknown;
};

type Listener = (event: MarketSocketEvent) => void;

const resolveWsUrl = (token?: string) => {
  const override = process.env.EXPO_PUBLIC_MARKET_WS_URL;
  const base = (override || APP_CONFIG.apiUrl).replace(/\/$/, '');
  const wsBase = base.startsWith('ws') ? base : base.replace(/^http/i, 'ws');
  const url = `${wsBase}/ws/market`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
};

class MarketSocketManager {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private shouldConnect = false;
  private authToken: string | null = null;

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    this.shouldConnect = true;
    this.connect();

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.teardown();
      }
    };
  }

  private connect() {
    if (!this.shouldConnect || this.listeners.size === 0) return;
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    if (!this.authToken) {
      this.emit({ type: 'unauthorized', message: 'No auth token available for WebSocket.' });
      return;
    }

    const wsUrl = resolveWsUrl(this.authToken);
    console.log(`[MarketSocket] Connecting (attempt ${this.reconnectAttempts + 1})`);

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (error) {
      this.emit({
        type: 'socketError',
        message: error instanceof Error ? error.message : 'Failed to initialize market socket.',
      });
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit({ type: 'socketOpen', url: wsUrl });
    };

    this.ws.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : '';
      try {
        const payload = JSON.parse(raw);
        if (payload && typeof payload === 'object' && typeof payload.type === 'string') {
          // Send ack for high-priority alerts (priority 1-2: CRASH/EXPLOSIVE)
          if (
            payload.type === 'marketAlert' &&
            payload.data?.priority != null &&
            payload.data.priority <= 2 &&
            payload.data.id &&
            this.ws?.readyState === WebSocket.OPEN
          ) {
            try {
              this.ws.send(JSON.stringify({ type: 'alertAck', alertId: payload.data.id }));
            } catch {
              // best-effort ack
            }
          }

          this.emit(payload as MarketSocketEvent);
          return;
        }
      } catch {
        // ignore parse failures and surface diagnostic event below
      }

      this.emit({ type: 'socketMessageError', raw });
    };

    this.ws.onerror = () => {
      console.warn(`[MarketSocket] Connection error for ${wsUrl}`);
      this.emit({ type: 'socketError', message: 'Market socket connection error.' });
    };

    this.ws.onclose = (event) => {
      console.log(`[MarketSocket] Connection closed (code=${event.code}, reason=${event.reason || 'none'})`);
      this.ws = null;
      this.emit({ type: 'socketClose', code: event.code, reason: event.reason });

      // Server rejected with 4401 — token is invalid/expired
      if (event.code === 4401) {
        this.emit({ type: 'unauthorized', message: 'WebSocket authentication failed.' });
        return;
      }

      if (!this.shouldConnect || this.listeners.size === 0) {
        return;
      }

      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || !this.shouldConnect || this.listeners.size === 0) {
      return;
    }

    this.reconnectAttempts += 1;
    const delayMs = Math.min(1000 * 2 ** Math.max(0, this.reconnectAttempts - 1), 30000);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delayMs);
  }

  // ADDED: public disconnect for logout — force-closes socket regardless of listeners
  disconnect() {
    this.listeners.clear();
    this.teardown();
  }

  private teardown() {
    this.shouldConnect = false;
    this.reconnectAttempts = 0;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore close errors
      }
      this.ws = null;
    }
  }

  private emit(event: MarketSocketEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch {
        // protect other listeners
      }
    });
  }
}

const marketSocketManager = new MarketSocketManager();

export const subscribeToMarketSocket = (listener: Listener) => marketSocketManager.subscribe(listener);

// Set JWT token for WebSocket authentication
export const setMarketSocketToken = (token: string | null) => marketSocketManager.setAuthToken(token);

// ADDED: explicit disconnect for logout — closes socket and clears all listeners
export const disconnectMarketSocket = () => marketSocketManager.disconnect();
