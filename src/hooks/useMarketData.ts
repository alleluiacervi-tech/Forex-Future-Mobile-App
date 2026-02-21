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

const DEFAULT_BASE_PRICES: Record<string, number> = {
  'EUR/USD': 1.08,
  'GBP/USD': 1.27,
  'USD/JPY': 157.5,
  'USD/CHF': 0.9,
  'AUD/USD': 0.66,
  'USD/CAD': 1.35,
  'NZD/USD': 0.61,
  'EUR/GBP': 0.85,
  'EUR/JPY': 160.5,
  'GBP/JPY': 188.0,
  'EUR/CHF': 0.95,
  'AUD/JPY': 98.0,
  'CAD/JPY': 110.0,
  'CHF/JPY': 170.0,
  'AUD/CAD': 0.89,
  'NZD/JPY': 90.0,
  'XAU/USD': 2925.0,
};

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

const buildSeedPairs = (): CurrencyPair[] =>
  Object.keys(MARKET_SYMBOL_MAP).map((pair) => {
    const [base, quote] = pair.split('/');
    const price = DEFAULT_BASE_PRICES[pair] ?? 1;
    return {
      id: pair,
      symbol: pair,
      base,
      quote,
      price,
      change: 0,
      changePercent: 0,
      high24h: price,
      low24h: price,
      volume24h: 0,
    };
  });

export const useMarketData = (refreshInterval: number = 5000) => {
  const initialMarketStatus = useMemo(() => getForexMarketStatus(), []);
  const marketStatusPollMs = Math.max(30_000, refreshInterval);
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

      const price = Number(priceValue);
      if (!Number.isFinite(price)) return;

      const volume = Number(volumeValue);
      const normalizedVolume = Number.isFinite(volume) ? volume : 0;

      setPairs((prevPairs) =>
        prevPairs.map((existingPair) => {
          if (existingPair.symbol !== pair) return existingPair;

          const prevPrice = previousPricesRef.current[pair] ?? existingPair.price;
          const change = price - prevPrice;
          const changePercent = prevPrice !== 0 ? (change / prevPrice) * 100 : 0;

          previousPricesRef.current[pair] = price;

          return {
            ...existingPair,
            price,
            change,
            changePercent,
            high24h: Math.max(existingPair.high24h, price),
            low24h: Math.min(existingPair.low24h, price),
            volume24h: existingPair.volume24h + normalizedVolume,
          };
        }),
      );
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
      if (typeof response?.market?.isOpen === 'boolean') {
        syncMarketOpenState(response.market.isOpen);
      } else {
        syncMarketOpenState(getForexMarketStatus().isOpen);
      }

      const rates = Array.isArray(response?.pairs) ? response.pairs : [];
      const quotes: Record<string, number> = {};

      rates.forEach((rate) => {
        if (!rate?.pair) return;
        const pair = String(rate.pair);
        const price = Number(rate.mid ?? rate.bid ?? rate.ask);
        if (!Number.isFinite(price) || !MARKET_SYMBOL_MAP[pair]) return;
        quotes[pair] = price;
      });

      setPairs((prevPairs) => {
        const sourcePairs = prevPairs.length > 0 ? prevPairs : buildSeedPairs();

        const nextPairs = sourcePairs.map((existingPair) => {
          const latestPrice = quotes[existingPair.symbol];
          if (!Number.isFinite(latestPrice)) {
            if (!Number.isFinite(previousPricesRef.current[existingPair.symbol])) {
              previousPricesRef.current[existingPair.symbol] = existingPair.price;
            }
            return existingPair;
          }

          const prevPrice = previousPricesRef.current[existingPair.symbol] ?? existingPair.price;
          const change = latestPrice - prevPrice;
          const changePercent = prevPrice !== 0 ? (change / prevPrice) * 100 : 0;
          previousPricesRef.current[existingPair.symbol] = latestPrice;

          return {
            ...existingPair,
            price: latestPrice,
            change,
            changePercent,
            high24h: Math.max(existingPair.high24h, latestPrice),
            low24h: Math.min(existingPair.low24h, latestPrice),
          };
        });

        return nextPairs;
      });

      if (Object.keys(quotes).length === 0) {
        setError((prev) => prev ?? 'Live quotes are temporarily unavailable. Showing last known prices.');
      } else {
        setError(null);
      }
    } catch (err) {
      console.error('[MarketData] Failed to fetch market data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch market data');

      setPairs((prevPairs) => {
        const fallbackPairs = prevPairs.length > 0 ? prevPairs : buildSeedPairs();
        fallbackPairs.forEach((pair) => {
          if (!Number.isFinite(previousPricesRef.current[pair.symbol])) {
            previousPricesRef.current[pair.symbol] = pair.price;
          }
        });
        return fallbackPairs;
      });
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
