import { useCallback, useEffect, useRef, useState } from 'react';
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

export const useMarketData = (refreshInterval = 5000) => {
  const [pairs, setPairs] = useState<CurrencyPair[]>(mockCurrencyPairs);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const lastPricesRef = useRef<Map<string, number>>(new Map());
  const highLowRef = useRef<Map<string, { high: number; low: number }>>(new Map());
  const isMountedRef = useRef(true);

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

  useInterval(() => {
    if (isActive) {
      fetchMarketData();
    }
  }, refreshInterval);

  return { pairs, loading, error, refetch: fetchMarketData };
};
