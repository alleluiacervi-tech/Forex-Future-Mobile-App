import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APP_CONFIG } from '../config';
import { apiGet } from '../services/api';
import { CurrencyPair } from '../types/market';
import { mockCurrencyPairs } from '../constants/marketData';
import { useInterval } from './useInterval';
import { useAppState } from './useAppState';

interface ApiRate {
  pair: string;
  bid?: number;
  ask?: number;
  mid?: number;
  spread?: number;
  volume?: number;
  timestamp?: string;
}

interface ApiPairsResponse {
  pairs: ApiRate[];
}

const toPrice = (rate: ApiRate) => {
  if (Number.isFinite(rate.mid)) return rate.mid as number;
  if (Number.isFinite(rate.bid) && Number.isFinite(rate.ask)) {
    return ((rate.bid as number) + (rate.ask as number)) / 2;
  }
  if (Number.isFinite(rate.bid)) return rate.bid as number;
  if (Number.isFinite(rate.ask)) return rate.ask as number;
  return 0;
};

const parsePair = (pair: string) => {
  const [base, quote] = pair.split('/');
  return { base: base || pair, quote: quote || '' };
};

const defaultSymbolMap: Record<string, string> = {
  'OANDA:EUR_USD': 'EUR/USD',
  'OANDA:GBP_USD': 'GBP/USD',
  'OANDA:USD_JPY': 'USD/JPY',
  'OANDA:USD_CHF': 'USD/CHF',
  'OANDA:AUD_USD': 'AUD/USD',
  'OANDA:NZD_USD': 'NZD/USD',
};

const buildWsUrl = (apiUrl: string) => {
  const base = apiUrl.replace(/\/$/, '');
  if (base.startsWith('ws://') || base.startsWith('wss://')) {
    return `${base}/ws/market`;
  }
  if (base.startsWith('https://')) return base.replace(/^https:\/\//, 'wss://') + '/ws/market';
  return base.replace(/^http:\/\//, 'ws://') + '/ws/market';
};

export const useMarketData = (refreshInterval = 5000) => {
  const [pairs, setPairs] = useState<CurrencyPair[]>(mockCurrencyPairs);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const lastPricesRef = useRef<Map<string, number>>(new Map());
  const highLowRef = useRef<Map<string, { high: number; low: number }>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const wsUrl = useMemo(() => buildWsUrl(APP_CONFIG.apiUrl), []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useAppState((state) => {
    setIsActive(state === 'active');
  });

  const fetchMarketData = useCallback(async () => {
    setLoading((prev) => prev && pairs.length === 0);
    setError(null);
    try {
      const response = await apiGet<ApiPairsResponse>('/api/market/pairs');
      const mapped = response.pairs.map((rate) => {
        const price = toPrice(rate);
        const previous = lastPricesRef.current.get(rate.pair);
        const change = previous ? price - previous : 0;
        const changePercent = previous ? (change / previous) * 100 : 0;
        lastPricesRef.current.set(rate.pair, price);

        const prevHighLow = highLowRef.current.get(rate.pair);
        const high = prevHighLow ? Math.max(prevHighLow.high, price) : price;
        const low = prevHighLow ? Math.min(prevHighLow.low, price) : price;
        highLowRef.current.set(rate.pair, { high, low });

        const { base, quote } = parsePair(rate.pair);

        return {
          id: rate.pair,
          symbol: rate.pair,
          base,
          quote,
          price,
          change,
          changePercent,
          high24h: high,
          low24h: low,
          volume24h: rate.volume ?? 0,
        } as CurrencyPair;
      });

      if (isMountedRef.current) {
        setPairs(mapped);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch market data';
      if (isMountedRef.current) {
        setError(message);
        if (!pairs.length) {
          setPairs(mockCurrencyPairs);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [pairs.length]);

  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  useEffect(() => {
    if (!isActive) {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
      }
      return;
    }

    let shouldReconnect = true;

    const applyTick = (pair: string, price: number, volume = 0) => {
      if (!Number.isFinite(price)) return;
      const previous = lastPricesRef.current.get(pair);
      const change = previous ? price - previous : 0;
      const changePercent = previous ? (change / previous) * 100 : 0;
      lastPricesRef.current.set(pair, price);

      const prevHighLow = highLowRef.current.get(pair);
      const high = prevHighLow ? Math.max(prevHighLow.high, price) : price;
      const low = prevHighLow ? Math.min(prevHighLow.low, price) : price;
      highLowRef.current.set(pair, { high, low });

      setPairs((current) => {
        const list = current.length ? current : mockCurrencyPairs;
        const index = list.findIndex((item) => item.symbol === pair);
        const { base, quote } = parsePair(pair);
        const nextItem: CurrencyPair = {
          id: pair,
          symbol: pair,
          base,
          quote,
          price,
          change,
          changePercent,
          high24h: high,
          low24h: low,
          volume24h: volume,
        };
        if (index === -1) {
          return [...list, nextItem];
        }
        const next = [...list];
        next[index] = { ...list[index], ...nextItem };
        return next;
      });
    };

    const handleMessage = (raw: string) => {
      let payload: any;
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }
      if (!payload || !Array.isArray(payload.data)) return;
      if (payload.type !== 'trade' && payload.type !== 'quote') return;

      payload.data.forEach((item: any) => {
        const symbol = item?.s;
        const pair = defaultSymbolMap[symbol] || item?.pair;
        if (!pair) return;
        const price =
          payload.type === 'trade'
            ? Number(item?.p)
            : Number.isFinite(item?.b) && Number.isFinite(item?.a)
              ? (Number(item?.b) + Number(item?.a)) / 2
              : Number(item?.p);
        const volume = Number(item?.v) || 0;
        if (!Number.isFinite(price)) return;
        applyTick(pair, price, volume);
      });
    };

    const connect = () => {
      if (!isActive) return;
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setError(null);
        };
        ws.onmessage = (event) => {
          handleMessage(event.data);
        };
        ws.onerror = () => {
          // Errors are handled by close + reconnect
        };
        ws.onclose = () => {
          if (!shouldReconnect || !isActive) return;
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
          }
          reconnectTimerRef.current = setTimeout(connect, 3000);
        };
      } catch {
        if (!shouldReconnect) return;
        reconnectTimerRef.current = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
    };
  }, [isActive, wsUrl]);

  useInterval(() => {
    if (isActive) {
      fetchMarketData();
    }
  }, refreshInterval);

  return { pairs, loading, error, refetch: fetchMarketData };
};
