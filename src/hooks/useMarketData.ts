import { useState, useEffect, useRef } from 'react';
import { CurrencyPair } from '../types/market';
import { apiGet } from '../services/api';
import { APP_CONFIG } from '../config/app';

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

  // Real-time WebSocket updates (connect to backend WS relay)
  useEffect(() => {
    const httpUrl = APP_CONFIG.apiUrl.replace(/\/$/, '');
    const wsUrl = httpUrl.replace(/^http/, 'ws') + '/ws/market';
    let ws: WebSocket | null = null;

    // Mapping from OANDA symbol to pair used by frontend
    const symbolToPair: Record<string, string> = {
      'OANDA:EUR_USD': 'EUR/USD',
      'OANDA:GBP_USD': 'GBP/USD',
      'OANDA:USD_JPY': 'USD/JPY',
      'OANDA:USD_CHF': 'USD/CHF',
      'OANDA:AUD_USD': 'AUD/USD',
      'OANDA:NZD_USD': 'NZD/USD'
    };

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('useMarketData: failed to create WS', err);
      return () => {};
    }

    ws.onopen = () => {
      try {
        // eslint-disable-next-line no-console
        console.log('useMarketData: WS connected', wsUrl);
      } catch {}
    };

    ws.onmessage = (evt) => {
      try {
        const msg = typeof evt.data === 'string' ? JSON.parse(evt.data) : null;
        if (!msg || !Array.isArray(msg.data)) return;

        // Handle trade and quote payloads
        if (msg.type === 'trade' || msg.type === 'quote') {
          const updates: Record<string, number> = {};
          msg.data.forEach((item: any) => {
            const symbol = item?.s;
            const pair = symbolToPair[symbol];
            if (!pair) return;
            if (msg.type === 'trade') {
              updates[pair] = Number(item?.p);
            } else if (msg.type === 'quote') {
              const b = Number(item?.b);
              const a = Number(item?.a);
              if (Number.isFinite(b) && Number.isFinite(a)) updates[pair] = (b + a) / 2;
            }
          });

          if (Object.keys(updates).length === 0) return;

          setPairs((current) => {
            const mapped = current.map((p) => {
              const newPrice = updates[p.pair];
              if (!Number.isFinite(newPrice)) return p;
              const prev = p.price;
              const change = newPrice - prev;
              const changePercent = prev ? (change / prev) * 100 : 0;
              const high24h = Math.max(p.high24h, newPrice);
              const low24h = Math.min(p.low24h, newPrice);
              return {
                ...p,
                price: newPrice,
                change,
                changePercent,
                high24h,
                low24h,
              };
            });
            // update previousPairsRef for polling side to compute diffs
            previousPairsRef.current = Object.fromEntries(mapped.map((pair) => [pair.symbol, pair]));
            return mapped;
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('useMarketData: WS message error', err);
      }
    };

    ws.onerror = (e) => {
      // eslint-disable-next-line no-console
      console.warn('useMarketData: WS error', e);
    };

    ws.onclose = () => {
      // eslint-disable-next-line no-console
      console.log('useMarketData: WS closed');
    };

    return () => {
      try {
        ws?.close();
      } catch {}
    };
  }, []);

  return { pairs, loading, error, refetch: fetchMarketData };
};
