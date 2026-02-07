import { useCallback, useEffect, useRef, useState } from 'react';
import { CurrencyPair } from '../types/market';
import { MAJOR_PAIRS } from '../constants/forexPairs';
import { apiPost } from '../services/api';
import { APP_CONFIG } from '../config';

// Map Finnhub symbols to our format
const FINNHUB_SYMBOL_MAP: Record<string, string> = {
  'EUR/USD': 'OANDA:EUR_USD',
  'GBP/USD': 'OANDA:GBP_USD',
  'USD/JPY': 'OANDA:USD_JPY',
  'USD/CHF': 'OANDA:USD_CHF',
  'AUD/USD': 'OANDA:AUD_USD',
  'USD/CAD': 'OANDA:USD_CAD',
  'NZD/USD': 'OANDA:NZD_USD',
};

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

export const useMarketData = (refreshInterval: number = 5000) => {
  const [pairs, setPairs] = useState<CurrencyPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const previousPricesRef = useRef<Record<string, number>>({});
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

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

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'trade' && Array.isArray(data.data)) {
            const trades = data.data;
            const latestTrade = trades[trades.length - 1]; // Get most recent trade
            
            if (latestTrade && latestTrade.s && latestTrade.p !== undefined) {
              const finnhubSymbol = latestTrade.s;
              const price = latestTrade.p;
              
              // Find our symbol
              const ourSymbol = Object.keys(FINNHUB_SYMBOL_MAP).find(
                key => FINNHUB_SYMBOL_MAP[key] === finnhubSymbol
              );
              
              if (ourSymbol) {
                setPairs(prevPairs => {
                  const updatedPairs = prevPairs.map(pair => {
                    if (pair.symbol === ourSymbol) {
                      const prevPrice = previousPricesRef.current[ourSymbol] || pair.price;
                      const change = price - prevPrice;
                      const changePercent = prevPrice !== 0 ? (change / prevPrice) * 100 : 0;
                      
                      // Store previous price for next calculation
                      previousPricesRef.current[ourSymbol] = price;
                      
                      return {
                        ...pair,
                        price,
                        change,
                        changePercent,
                        high24h: Math.max(pair.high24h, price),
                        low24h: Math.min(pair.low24h, price),
                        volume24h: pair.volume24h + (latestTrade.v || 0),
                      };
                    }
                    return pair;
                  });
                  return updatedPairs;
                });
              }
            }
          }
        } catch (err) {
          console.error('[MarketData] Error parsing WebSocket message:', err);
        }
      };

      wsRef.current.onerror = (err) => {
        console.error('[MarketData] WebSocket error:', err);
        setError('Connection error');
      };

      wsRef.current.onclose = (event) => {
        console.log('[MarketData] WebSocket closed:', event.code, event.reason);
        
        // Attempt reconnection with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          
          console.log(`[MarketData] Reconnecting in ${backoffMs}ms (attempt ${reconnectAttemptsRef.current})`);
          
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
  }, []);

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

      const symbols = Object.values(FINNHUB_SYMBOL_MAP);
      const promises = symbols.map(symbol => 
        apiPost<QuoteResponse>('/api/market/quote', { symbol }).catch(() => null)
      );
      
      const results = await Promise.all(promises);
      const quotes: Record<string, number> = {};
      
      results.forEach((result, index) => {
        if (typeof result?.currentPrice === 'number') {
          const ourSymbol = Object.keys(FINNHUB_SYMBOL_MAP).find(
            key => FINNHUB_SYMBOL_MAP[key] === symbols[index]
          );
          if (ourSymbol) {
            quotes[ourSymbol] = result.currentPrice;
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
