import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CurrencyPair } from '../types/market';
import { apiGet } from '../services/api';
import { APP_CONFIG } from '../config';
import { getForexMarketStatus } from '../utils';

// Display pair -> upstream FCS symbol
const MARKET_SYMBOL_MAP: Record<string, string> = {
  'EUR/USD': 'FX:EURUSD',
  'GBP/USD': 'FX:GBPUSD',
  'USD/JPY': 'FX:USDJPY',
  'USD/CHF': 'FX:USDCHF',
  'AUD/USD': 'FX:AUDUSD',
  'USD/CAD': 'FX:USDCAD',
  'NZD/USD': 'FX:NZDUSD',
  'EUR/GBP': 'FX:EURGBP',
  'EUR/JPY': 'FX:EURJPY',
  'GBP/JPY': 'FX:GBPJPY',
  'EUR/CHF': 'FX:EURCHF',
  'AUD/JPY': 'FX:AUDJPY',
  'CAD/JPY': 'FX:CADJPY',
  'CHF/JPY': 'FX:CHFJPY',
  'AUD/CAD': 'FX:AUDCAD',
  'NZD/JPY': 'FX:NZDJPY',
  'XAU/USD': 'FX:XAUUSD',
};

const SYMBOL_TO_PAIR_MAP = Object.entries(MARKET_SYMBOL_MAP).reduce<Record<string, string>>(
  (acc, [pair, symbol]) => {
    acc[symbol] = pair;
    return acc;
  },
  {},
);

const PAIR_ORDER_INDEX = Object.keys(MARKET_SYMBOL_MAP).reduce<Record<string, number>>(
  (acc, pair, index) => {
    acc[pair] = index;
    return acc;
  },
  {},
);

type MarketRate = {
  pair: string;
  bid?: number;
  ask?: number;
  mid?: number;
  timestamp?: string;
};

type MarketPairsResponse = {
  pairs?: MarketRate[];
  market?: {
    isOpen?: boolean;
  };
};

const sortPairs = (input: CurrencyPair[]) =>
  input
    .slice()
    .sort((a, b) => (PAIR_ORDER_INDEX[a.symbol] ?? Number.MAX_SAFE_INTEGER) - (PAIR_ORDER_INDEX[b.symbol] ?? Number.MAX_SAFE_INTEGER));

const buildPairSnapshot = (
  pair: string,
  price: number,
  volume: number,
  existing?: CurrencyPair,
  previousPrice?: number,
): CurrencyPair => {
  const [base = pair.slice(0, 3), quote = pair.slice(4, 7)] = pair.split('/');
  const referencePrice = Number.isFinite(previousPrice as number) ? Number(previousPrice) : price;
  const change = price - referencePrice;
  const changePercent = referencePrice !== 0 ? (change / referencePrice) * 100 : 0;

  return {
    id: pair,
    symbol: pair,
    base,
    quote,
    price,
    change,
    changePercent,
    high24h: existing ? Math.max(existing.high24h, price) : price,
    low24h: existing ? Math.min(existing.low24h, price) : price,
    volume24h: (existing?.volume24h ?? 0) + volume,
  };
};

export const useMarketData = (refreshInterval: number = 5000) => {
  const initialMarketStatus = useMemo(() => getForexMarketStatus(), []);
  const marketStatusPollMs = Math.max(5_000, Math.min(refreshInterval, 30_000));
  const maxReconnectAttempts = 5;

  const [pairs, setPairs] = useState<CurrencyPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMarketOpen, setIsMarketOpen] = useState(initialMarketStatus.isOpen);

  const wsRef = useRef<WebSocket | null>(null);
  const previousPricesRef = useRef<Record<string, number>>({});
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const marketOpenRef = useRef(initialMarketStatus.isOpen);
  const allowReconnectRef = useRef(true);
  const previousOpenStateRef = useRef(initialMarketStatus.isOpen);

  const syncMarketOpenState = useCallback((nextIsOpen: boolean) => {
    marketOpenRef.current = nextIsOpen;
    setIsMarketOpen((prev) => (prev === nextIsOpen ? prev : nextIsOpen));
  }, []);

  const applyPriceUpdate = useCallback(
    (pair: string, priceValue: unknown, volumeValue: unknown = 0) => {
      if (!marketOpenRef.current) return;
      if (!MARKET_SYMBOL_MAP[pair]) return;

      const price = Number(priceValue);
      if (!Number.isFinite(price)) return;

      const volume = Number(volumeValue);
      const normalizedVolume = Number.isFinite(volume) ? volume : 0;

      setPairs((prevPairs) => {
        const existing = prevPairs.find((item) => item.symbol === pair);
        const prevPrice = previousPricesRef.current[pair] ?? existing?.price ?? price;

        previousPricesRef.current[pair] = price;

        if (existing) {
          return prevPairs.map((item) =>
            item.symbol === pair
              ? buildPairSnapshot(pair, price, normalizedVolume, existing, prevPrice)
              : item,
          );
        }

        return sortPairs([...prevPairs, buildPairSnapshot(pair, price, normalizedVolume, undefined, prevPrice)]);
      });
    },
    [],
  );

  const disconnectWebSocket = useCallback((manual: boolean = true) => {
    if (manual) {
      allowReconnectRef.current = false;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore close failures
      }
      wsRef.current = null;
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (!marketOpenRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    allowReconnectRef.current = true;

    try {
      const wsBaseOverride = process.env.EXPO_PUBLIC_MARKET_WS_URL;
      const base = (wsBaseOverride || APP_CONFIG.apiUrl).replace(/\/$/, '');
      const wsBase = base.startsWith('ws') ? base : base.replace(/^http/, 'ws');
      const wsUrl = `${wsBase}/ws/market`;

      console.log('[MarketData] Connecting to market WebSocket:', wsUrl);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('[MarketData] WebSocket connected');
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data?.type === 'welcome' && typeof data?.market?.isOpen === 'boolean') {
            syncMarketOpenState(data.market.isOpen);
          }

          if (data?.type === 'marketStatus' && typeof data?.data?.isOpen === 'boolean') {
            syncMarketOpenState(data.data.isOpen);
          }

          if (!marketOpenRef.current) return;

          // Backend relay format
          if (data.type === 'trade' && Array.isArray(data.data)) {
            const latestTrade = data.data[data.data.length - 1];
            if (latestTrade?.s && latestTrade?.p !== undefined) {
              const pair = SYMBOL_TO_PAIR_MAP[latestTrade.s];
              if (pair) {
                applyPriceUpdate(pair, latestTrade.p, latestTrade.v);
              }
            }
            return;
          }

          // Accept direct FCS payloads too (defensive compatibility).
          if (data.type === 'price' && data.symbol && data.prices?.c !== undefined) {
            const pair = SYMBOL_TO_PAIR_MAP[data.symbol];
            if (pair) {
              applyPriceUpdate(pair, data.prices.c, data.prices.v);
            }
          }
        } catch (err) {
          console.error('[MarketData] Error parsing WebSocket message:', err);
        }
      };

      wsRef.current.onerror = (err) => {
        console.error('[MarketData] WebSocket error:', err);
        if (marketOpenRef.current) {
          setError('Connection error');
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('[MarketData] WebSocket closed:', event.code, event.reason);
        wsRef.current = null;

        if (!allowReconnectRef.current || !marketOpenRef.current) {
          return;
        }

        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30_000);

          console.log(
            `[MarketData] Reconnecting in ${backoffMs}ms (attempt ${reconnectAttemptsRef.current})`,
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, backoffMs);
        } else {
          setError('Unable to connect to market data');
          console.error('[MarketData] Max reconnection attempts reached');
        }
      };
    } catch (err) {
      console.error('[MarketData] Failed to create WebSocket:', err);
      if (marketOpenRef.current) {
        setError('Failed to connect to market data');
      }
    }
  }, [applyPriceUpdate, syncMarketOpenState]);

  const fetchMarketData = useCallback(async () => {
    setLoading(true);

    try {
      const response = await apiGet<MarketPairsResponse>('/api/market/pairs');
      const serverMarketOpen =
        typeof response?.market?.isOpen === 'boolean'
          ? response.market.isOpen
          : getForexMarketStatus().isOpen;
      syncMarketOpenState(serverMarketOpen);

      const rates = Array.isArray(response?.pairs) ? response.pairs : [];
      const normalizedRates = rates
        .map((rate) => {
          if (!rate?.pair) return null;
          const pair = String(rate.pair);
          if (!MARKET_SYMBOL_MAP[pair]) return null;
          const price = Number(rate.mid ?? rate.bid ?? rate.ask);
          if (!Number.isFinite(price)) return null;
          return { pair, price };
        })
        .filter((item): item is { pair: string; price: number } => Boolean(item));

      setPairs((prevPairs) => {
        const previousByPair = new Map(prevPairs.map((pair) => [pair.symbol, pair]));
        const nextPairs: CurrencyPair[] = [];

        normalizedRates.forEach(({ pair, price }) => {
          const existing = previousByPair.get(pair);
          const previousPrice = previousPricesRef.current[pair] ?? existing?.price ?? price;

          previousPricesRef.current[pair] = price;
          nextPairs.push(buildPairSnapshot(pair, price, 0, existing, previousPrice));
        });

        if (nextPairs.length === 0) {
          return serverMarketOpen ? [] : prevPairs;
        }

        return sortPairs(nextPairs);
      });

      if (normalizedRates.length === 0) {
        if (serverMarketOpen) {
          setError('Market is open. Waiting for first live WS quotes...');
        } else {
          setError(null);
        }
      } else {
        setError(null);
      }
    } catch (err) {
      console.error('[MarketData] Failed to fetch market data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch market data');
    } finally {
      setLoading(false);
    }
  }, [syncMarketOpenState]);

  useEffect(() => {
    const tick = () => {
      syncMarketOpenState(getForexMarketStatus().isOpen);
    };

    tick();
    const intervalId = setInterval(tick, marketStatusPollMs);
    return () => clearInterval(intervalId);
  }, [marketStatusPollMs, syncMarketOpenState]);

  useEffect(() => {
    void fetchMarketData();
    return () => {
      disconnectWebSocket(true);
    };
  }, [fetchMarketData, disconnectWebSocket]);

  useEffect(() => {
    const wasOpen = previousOpenStateRef.current;
    previousOpenStateRef.current = isMarketOpen;

    if (isMarketOpen) {
      if (!wasOpen) {
        void fetchMarketData();
      }
      connectWebSocket();
      return;
    }

    disconnectWebSocket(true);
  }, [connectWebSocket, disconnectWebSocket, fetchMarketData, isMarketOpen]);

  return { pairs, loading, error, refetch: fetchMarketData, isMarketOpen };
};
