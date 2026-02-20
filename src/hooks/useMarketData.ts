import { useCallback, useEffect, useRef, useState } from 'react';
import { CurrencyPair } from '../types/market';
import { apiPost } from '../services/api';
import { APP_CONFIG } from '../config';

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
  {}
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

const jitterForPair = (pair: string): number => {
  if (pair === 'XAU/USD') return 2.0;
  if (pair.endsWith('/JPY')) return 0.12;
  return 0.002;
};

const generateInitialPairs = (): CurrencyPair[] => {
  return Object.keys(MARKET_SYMBOL_MAP).map(symbol => {
    const [base, quote] = symbol.split('/');
    const basePrice = DEFAULT_BASE_PRICES[symbol] ?? 1.0;
    const price = basePrice + (Math.random() - 0.5) * jitterForPair(symbol);

    return {
      id: symbol,
      symbol,
      base,
      quote,
      price,
      change: 0,
      changePercent: 0,
      high24h: price * 1.005,
      low24h: price * 0.995,
      volume24h: Math.floor(Math.random() * 900000000) + 100000000,
    };
  });
};

export const useMarketData = (refreshInterval: number = 5000) => {
  const [pairs, setPairs] = useState<CurrencyPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const previousPricesRef = useRef<Record<string, number>>({});
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Keeps the existing hook signature stable.
  void refreshInterval;

  const applyPriceUpdate = useCallback((pair: string, priceValue: unknown, volumeValue: unknown = 0) => {
    const price = Number(priceValue);
    if (!Number.isFinite(price)) return;

    const volume = Number(volumeValue);
    const normalizedVolume = Number.isFinite(volume) ? volume : 0;

    setPairs(prevPairs => {
      return prevPairs.map(existingPair => {
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
      });
    });
  }, []);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

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

      wsRef.current.onmessage = event => {
        try {
          const data = JSON.parse(event.data);

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

      wsRef.current.onerror = err => {
        console.error('[MarketData] WebSocket error:', err);
        setError('Connection error');
      };

      wsRef.current.onclose = event => {
        console.log('[MarketData] WebSocket closed:', event.code, event.reason);

        // Attempt reconnection with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);

          console.log(
            `[MarketData] Reconnecting in ${backoffMs}ms (attempt ${reconnectAttemptsRef.current})`
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
      setError('Failed to connect to market data');
    }
  }, [applyPriceUpdate]);

  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const fetchMarketData = useCallback(async () => {
    // Load initial data while WebSocket connects
    setLoading(true);
    setError(null);

    try {
      // Try to get current prices from API as fallback
      type QuoteResponse = {
        pair: string;
        currentPrice: number;
        bid?: number;
        ask?: number;
        timestamp?: string;
      };

      const symbols = Object.values(MARKET_SYMBOL_MAP);
      const promises = symbols.map(symbol =>
        apiPost<QuoteResponse>('/api/market/quote', { symbol }).catch(() => null)
      );

      const results = await Promise.all(promises);
      const quotes: Record<string, number> = {};

      results.forEach((result, index) => {
        if (typeof result?.currentPrice === 'number') {
          const pair = SYMBOL_TO_PAIR_MAP[symbols[index]];
          if (pair) {
            quotes[pair] = result.currentPrice;
          }
        }
      });

      // Generate pairs with real prices if available
      const initial = generateInitialPairs().map(pair => ({
        ...pair,
        price: quotes[pair.symbol] || pair.price,
        high24h: quotes[pair.symbol] ? quotes[pair.symbol] * 1.005 : pair.high24h,
        low24h: quotes[pair.symbol] ? quotes[pair.symbol] * 0.995 : pair.low24h,
      }));

      setPairs(initial);

      // Initialize previous prices
      initial.forEach(pair => {
        previousPricesRef.current[pair.symbol] = pair.price;
      });
    } catch (err) {
      console.error('[MarketData] Failed to fetch initial data:', err);
      // Still load mock data as fallback
      const initial = generateInitialPairs();
      setPairs(initial);
      initial.forEach(pair => {
        previousPricesRef.current[pair.symbol] = pair.price;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize data and WebSocket
  useEffect(() => {
    fetchMarketData();
    connectWebSocket();

    return () => {
      disconnectWebSocket();
    };
  }, [fetchMarketData, connectWebSocket, disconnectWebSocket]);

  return { pairs, loading, error, refetch: fetchMarketData };
};
