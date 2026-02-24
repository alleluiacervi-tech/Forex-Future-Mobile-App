import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CurrencyPair } from '../types/market';
import { apiGet } from '../services/api';
import { subscribeToMarketSocket } from '../services/marketSocket';
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
    .sort(
      (a, b) =>
        (PAIR_ORDER_INDEX[a.symbol] ?? Number.MAX_SAFE_INTEGER) -
        (PAIR_ORDER_INDEX[b.symbol] ?? Number.MAX_SAFE_INTEGER),
    );

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

const MARKET_PAIRS_QUERY_KEY = ['marketPairs'] as const;

export const useMarketData = (refreshInterval: number = 5000) => {
  const initialMarketStatus = useMemo(() => getForexMarketStatus(), []);
  const marketStatusPollMs = Math.max(5000, Math.min(refreshInterval, 30000));

  const [pairs, setPairs] = useState<CurrencyPair[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isMarketOpen, setIsMarketOpen] = useState(initialMarketStatus.isOpen);

  const previousPricesRef = useRef<Record<string, number>>({});
  const marketOpenRef = useRef(initialMarketStatus.isOpen);

  const syncMarketOpenState = useCallback((nextIsOpen: boolean) => {
    marketOpenRef.current = nextIsOpen;
    setIsMarketOpen((prev) => (prev === nextIsOpen ? prev : nextIsOpen));
  }, []);

  const applyPriceUpdate = useCallback((pair: string, priceValue: unknown, volumeValue: unknown = 0) => {
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

      return sortPairs([
        ...prevPairs,
        buildPairSnapshot(pair, price, normalizedVolume, undefined, prevPrice),
      ]);
    });

    setError((prev) => (prev === 'Connection error' ? null : prev));
  }, []);

  const marketPairsQuery = useQuery({
    queryKey: MARKET_PAIRS_QUERY_KEY,
    queryFn: () => apiGet<MarketPairsResponse>('/api/market/pairs'),
    staleTime: Math.max(3000, Math.floor(refreshInterval * 0.8)),
    gcTime: 5 * 60 * 1000,
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!marketPairsQuery.data) return;

    const response = marketPairsQuery.data;
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
      const previousByPair = new Map(prevPairs.map((item) => [item.symbol, item]));
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
      return;
    }

    setError(null);
  }, [marketPairsQuery.data, syncMarketOpenState]);

  useEffect(() => {
    if (!marketPairsQuery.error) return;
    setError(
      marketPairsQuery.error instanceof Error
        ? marketPairsQuery.error.message
        : 'Failed to fetch market data',
    );
  }, [marketPairsQuery.error]);

  useEffect(() => {
    const unsubscribe = subscribeToMarketSocket((event) => {
      if (event.type === 'welcome' && typeof (event.market as any)?.isOpen === 'boolean') {
        syncMarketOpenState(Boolean((event.market as any).isOpen));
        return;
      }

      if (event.type === 'marketStatus' && typeof (event.data as any)?.isOpen === 'boolean') {
        syncMarketOpenState(Boolean((event.data as any).isOpen));
        return;
      }

      if (event.type === 'trade' && Array.isArray(event.data)) {
        const latestTrade = event.data[event.data.length - 1] as any;
        if (!latestTrade?.s || latestTrade?.p === undefined) return;
        const pair = SYMBOL_TO_PAIR_MAP[String(latestTrade.s)];
        if (!pair) return;
        applyPriceUpdate(pair, latestTrade.p, latestTrade.v);
        return;
      }

      if (
        event.type === 'price' &&
        typeof event.symbol === 'string' &&
        (event as any).prices?.c !== undefined
      ) {
        const pair = SYMBOL_TO_PAIR_MAP[event.symbol];
        if (!pair) return;
        applyPriceUpdate(pair, (event as any).prices.c, (event as any).prices.v);
        return;
      }

      if (event.type === 'socketError' && marketOpenRef.current) {
        setError('Connection error');
      }
    });

    return unsubscribe;
  }, [applyPriceUpdate, syncMarketOpenState]);

  useEffect(() => {
    const tick = () => {
      syncMarketOpenState(getForexMarketStatus().isOpen);
    };

    tick();
    const intervalId = setInterval(tick, marketStatusPollMs);
    return () => clearInterval(intervalId);
  }, [marketStatusPollMs, syncMarketOpenState]);

  const refetch = useCallback(async () => {
    await marketPairsQuery.refetch();
  }, [marketPairsQuery]);

  return {
    pairs,
    loading: marketPairsQuery.isLoading && pairs.length === 0,
    error,
    refetch,
    isMarketOpen,
  };
};
