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
  const initializedRef = useRef(false);

  const fetchMarketData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ pairs: ApiMarketPair[] }>('/api/market/pairs');
      try {
        // eslint-disable-next-line no-console
        console.log('[REST] fetched pairs:', data.pairs.map(p => ({ pair: p.pair, mid: p.mid })));
      } catch {}
      const nextPairs = data.pairs.map((apiPair) =>
        buildCurrencyPair(apiPair, previousPairsRef.current[apiPair.pair]),
      );
      previousPairsRef.current = Object.fromEntries(
        nextPairs.map((pair) => [pair.symbol, pair]),
      );
      initializedRef.current = true;
      setPairs(nextPairs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch market data');
    } finally {
      setLoading(false);
    }
  };

  // Load initial prices once from REST
  useEffect(() => {
    fetchMarketData();
    // Do NOT poll. WS provides real-time updates instead.
    // eslint-disable-next-line no-console
    console.log('[INIT] Market data hook initialized. Listening to WS for real-time updates.');
  }, []);

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
      console.warn('[WS] ❌ Failed to create WS:', err);
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
        if (!msg) {
          try {
            // eslint-disable-next-line no-console
            console.log('[WS] received non-JSON message');
          } catch {}
          return;
        }
        if (!Array.isArray(msg.data)) {
          try {
            // eslint-disable-next-line no-console
            console.log('[WS] received message with no data array:', msg.type);
          } catch {}
          return;
        }

        // Handle trade and quote payloads
        if (msg.type === 'trade' || msg.type === 'quote') {
          try {
            // eslint-disable-next-line no-console
            console.log(`[WS] ${msg.type} message arrived with ${msg.data.length} items:`, msg.data.slice(0, 2));
          } catch {}
          
          const updates: Record<string, number> = {};
          msg.data.forEach((item: any) => {
            const symbol = item?.s;
            const pair = symbolToPair[symbol];
            if (!pair) {
              try {
                // eslint-disable-next-line no-console
                console.log('[WS] unmapped symbol:', symbol);
              } catch {}
              return;
            }
            if (msg.type === 'trade') {
              const price = Number(item?.p);
              updates[pair] = price;
              try {
                // eslint-disable-next-line no-console
                console.log(`[WS] trade: ${symbol} (${pair}) @ ${price}`);
              } catch {}
            } else if (msg.type === 'quote') {
              const b = Number(item?.b);
              const a = Number(item?.a);
              if (Number.isFinite(b) && Number.isFinite(a)) {
                const mid = (b + a) / 2;
                updates[pair] = mid;
                try {
                  // eslint-disable-next-line no-console
                  console.log(`[WS] quote: ${symbol} (${pair}) bid=${b} ask=${a} mid=${mid}`);
                } catch {}
              }
            }
          });

          if (Object.keys(updates).length === 0) {
            try {
              // eslint-disable-next-line no-console
              console.log('[WS] no valid updates extracted');
            } catch {}
            return;
          }

          try {
            // eslint-disable-next-line no-console
            console.log('[WS] applying updates to state:', updates);
          } catch {}

          setPairs((current) => {
            const mapped = current.map((p) => {
              const newPrice = updates[p.symbol];
              if (!Number.isFinite(newPrice)) return p;
              
              const prev = initializedRef.current ? previousPairsRef.current[p.symbol]?.price : p.price;
              const change = prev ? newPrice - prev : 0;
              const changePercent = prev ? (change / prev) * 100 : 0;
              
              try {
                // eslint-disable-next-line no-console
                console.log(`[STATE] ${p.symbol}: prev=${prev} → ${newPrice} (Δ ${change.toFixed(5)}, ${changePercent.toFixed(2)}%)`);
              } catch {}
              
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
            
            // update previousPairsRef for next comparison
            previousPairsRef.current = Object.fromEntries(
              mapped.map((pair) => [pair.symbol, pair])
            );
            
            try {
              // eslint-disable-next-line no-console
              console.log('[STATE] setPairs called, new state ready for render');
            } catch {}
            
            return mapped;
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[WS] message handler error:', err);
      }
    };

    ws.onerror = (e) => {
      // eslint-disable-next-line no-console
      console.warn('[WS] ❌ ERROR:', e);
    };

    ws.onclose = () => {
      // eslint-disable-next-line no-console
      console.log('[WS] 🔌 DISCONNECTED');
    };

    return () => {
      try {
        ws?.close();
      } catch {}
    };
  }, []);

  return { pairs, loading, error, refetch: fetchMarketData };
};
