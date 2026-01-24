import { useState, useEffect, useRef } from 'react';
import { CurrencyPair } from '../types/market';
import { apiGet } from '../services/api';

interface ApiMarketPair {
  pair: string;
  bid: number;
  ask: number;
  mid: number;
  volume: number;
  timestamp: string;
}

const buildCurrencyPair = (
  apiPair: ApiMarketPair,
  previous?: CurrencyPair,
): CurrencyPair => {
  const [base, quote] = apiPair.pair.split('/');
  const price = apiPair.mid;
  const change = previous ? price - previous.price : 0;
  const changePercent = previous && previous.price ? (change / previous.price) * 100 : 0;
  const high24h = previous ? Math.max(previous.high24h, price) : price;
  const low24h = previous ? Math.min(previous.low24h, price) : price;
  const volume24h = previous ? previous.volume24h + apiPair.volume : apiPair.volume;

  return {
    id: apiPair.pair,
    symbol: apiPair.pair,
    base,
    quote,
    price,
    change,
    changePercent,
    high24h,
    low24h,
    volume24h,
  };
};

export const useMarketData = (refreshInterval: number = 5000) => {
  const [pairs, setPairs] = useState<CurrencyPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousPairsRef = useRef<Record<string, CurrencyPair>>({});

  const fetchMarketData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ pairs: ApiMarketPair[] }>('/api/market/pairs');
      // Debug: log fetched pairs to RN console for troubleshooting
      try {
        // eslint-disable-next-line no-console
        console.log('useMarketData: fetched pairs sample', data.pairs.slice(0,3).map(p => ({ pair: p.pair, mid: p.mid })));
      } catch {}
      const nextPairs = data.pairs.map((apiPair) =>
        buildCurrencyPair(apiPair, previousPairsRef.current[apiPair.pair]),
      );
      previousPairsRef.current = Object.fromEntries(
        nextPairs.map((pair) => [pair.symbol, pair]),
      );
      setPairs(nextPairs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch market data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { pairs, loading, error, refetch: fetchMarketData };
};
