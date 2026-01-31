import { useCallback, useEffect, useRef, useState } from 'react';
import { CurrencyPair } from '../types/market';
import { MAJOR_PAIRS } from '../constants/forexPairs';

// Generate realistic initial prices
const generateInitialPairs = (): CurrencyPair[] => {
  return MAJOR_PAIRS.map(symbol => {
    const [base, quote] = symbol.split('/');
    const basePrice: Record<string, number> = {
      'EUR/USD': 1.08,
      'GBP/USD': 1.27,
      'USD/JPY': 157.5,
      'USD/CHF': 0.90,
      'AUD/USD': 0.66,
      'NZD/USD': 0.61,
    };
    const price = (basePrice[symbol] ?? 1.0) + (Math.random() - 0.5) * 0.002;
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

// Simulate realistic price ticks
const simulateTick = (pairs: CurrencyPair[]): CurrencyPair[] => {
  return pairs.map(p => {
    const volatility = 0.0002; // 2 pips typical
    const trend = Math.random() > 0.5 ? 1 : -1;
    const jump = (Math.random() * volatility + volatility * 0.1) * trend;
    const newPrice = Math.max(0.0001, p.price + jump);
    const change = newPrice - p.price;
    const changePercent = p.price !== 0 ? (change / p.price) * 100 : 0;
    return {
      ...p,
      price: newPrice,
      change,
      changePercent,
      high24h: Math.max(p.high24h, newPrice),
      low24h: Math.min(p.low24h, newPrice),
    };
  });
};

export const useMarketData = (refreshInterval: number = 5000) => {
  const [pairs, setPairs] = useState<CurrencyPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMarketData = useCallback(async () => {
    // Simulate async
    setLoading(true);
    setError(null);
    await new Promise(r => setTimeout(r, 300));
    const initial = generateInitialPairs();
    setPairs(initial);
    setLoading(false);
  }, []);

  // Load initial mock data
  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  // Simulate real-time ticks
  useEffect(() => {
    if (pairs.length === 0) return;
    intervalRef.current = setInterval(() => {
      setPairs(prev => simulateTick(prev));
    }, refreshInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pairs.length, refreshInterval]);

  return { pairs, loading, error, refetch: fetchMarketData };
};