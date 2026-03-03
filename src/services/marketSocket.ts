import { APP_CONFIG } from '../config';

export type MarketSocketEvent = {
  type: string;
  [key: string]: unknown;
};

type Listener = (event: MarketSocketEvent) => void;

const resolveWsUrl = () => {
  const override = process.env.EXPO_PUBLIC_MARKET_WS_URL;
  const base = (override || APP_CONFIG.apiUrl).replace(/\/$/, '');
  const wsBase = base.startsWith('ws') ? base : base.replace(/^http/i, 'ws');
  return `${wsBase}/ws/market`;
};

class MarketSocketManager {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private shouldConnect = false;

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

    const wsUrl = resolveWsUrl();
    console.log(`[MarketSocket] Connecting to ${wsUrl} (attempt ${this.reconnectAttempts + 1})`);

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

      if (!this.shouldConnect || this.listeners.size === 0) {
        return;
      }

      this.scheduleReconnect();
    };
  }

  private static readonly MAX_RECONNECT_ATTEMPTS = 10;

  private scheduleReconnect() {
    if (this.reconnectTimer || !this.shouldConnect || this.listeners.size === 0) {
      return;
    }

    this.reconnectAttempts += 1;
    if (this.reconnectAttempts > MarketSocketManager.MAX_RECONNECT_ATTEMPTS) {
      this.emit({ type: 'socketError', message: 'Max reconnect attempts reached. Call subscribe() again to retry.' });
      return;
    }
    const delayMs = Math.min(1000 * 2 ** Math.max(0, this.reconnectAttempts - 1), 30000);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delayMs);
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
