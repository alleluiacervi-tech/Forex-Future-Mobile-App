import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '../services/api';
import { subscribeToMarketSocket } from '../services/marketSocket';
import type { MarketAlert } from '../types/alerts';

type ApiMarketAlert = {
  id?: string;
  pair?: string;
  windowMinutes?: number;
  fromPrice?: number;
  toPrice?: number;
  currentPrice?: number;
  changePercent?: number;
  severity?: string;
  triggeredAt?: string;
  createdAt?: string;
  message?: string;
  velocity?: MarketAlert['velocity'];
  levels?: MarketAlert['levels'];
  confidence?: MarketAlert['confidence'];
  direction?: string;
  priority?: number;
  confluenceScore?: number;
  confluenceSignals?: string[];
};

type ApiMarketAlertsResponse = {
  alerts: ApiMarketAlert[];
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const windowLabel = (windowMinutes: number) => {
  if (windowMinutes === 60) return '1h';
  if (windowMinutes === 240) return '4h';
  if (windowMinutes === 1440) return '1d';
  if (windowMinutes > 0 && windowMinutes % 60 === 0) return `${windowMinutes / 60}h`;
  if (windowMinutes > 0) return `${windowMinutes}m`;
  return 'live';
};

const decimalsForPair = (pair: string) => (pair.includes('JPY') ? 3 : 5);

const formatPairPrice = (pair: string, price: unknown) => {
  const n = Number(price);
  const decimals = decimalsForPair(pair);
  return Number.isFinite(n) ? n.toFixed(decimals) : 'N/A';
};

const minutesAgoFromIso = (iso?: string) => {
  if (!iso) return undefined;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return undefined;
  return Math.max(0, Math.round((Date.now() - ts) / 60000));
};

const normalizeAlert = (alert: ApiMarketAlert): MarketAlert | null => {
  const pair = typeof alert.pair === 'string' && alert.pair.trim() ? alert.pair : null;
  if (!pair) return null;

  const triggeredAt =
    (typeof alert.triggeredAt === 'string' && alert.triggeredAt) ||
    (typeof alert.createdAt === 'string' && alert.createdAt) ||
    new Date().toISOString();

  const windowMinutes = Number(alert.windowMinutes);
  const timeframe = windowLabel(Number.isFinite(windowMinutes) ? windowMinutes : 0);
  const change = Number(alert.changePercent);
  const normalizedChange = Number.isFinite(change) ? change : undefined;

  const fromPrice = Number(alert.fromPrice);
  const toPrice = Number(alert.toPrice ?? alert.currentPrice);
  const hasFromPrice = Number.isFinite(fromPrice);
  const hasToPrice = Number.isFinite(toPrice);

  const direction =
    typeof alert.direction === 'string' && alert.direction
      ? alert.direction
      : normalizedChange !== undefined
        ? normalizedChange >= 0
          ? 'up'
          : 'down'
        : undefined;

  const changeSign = normalizedChange !== undefined && normalizedChange >= 0 ? '+' : '';
  const absoluteChange = normalizedChange !== undefined ? Math.abs(normalizedChange) : undefined;

  const title =
    normalizedChange !== undefined
      ? `Big move: ${pair} ${changeSign}${absoluteChange?.toFixed(2)}% (${timeframe})`
      : `High volatility: ${pair} (${timeframe})`;

  const message =
    typeof alert.message === 'string' && alert.message.trim()
      ? alert.message.trim()
      : hasFromPrice && hasToPrice && normalizedChange !== undefined
        ? `${pair} moved ${direction || 'up'} from ${formatPairPrice(pair, fromPrice)} to ${formatPairPrice(pair, toPrice)} (${changeSign}${absoluteChange?.toFixed(2)}%) in ${timeframe}.`
        : hasFromPrice && hasToPrice
          ? `${pair} moved from ${formatPairPrice(pair, fromPrice)} to ${formatPairPrice(pair, toPrice)} in ${timeframe}.`
          : `${pair} is showing elevated volatility in ${timeframe}.`;

  const id =
    (typeof alert.id === 'string' && alert.id) ||
    `${pair}-${triggeredAt}-${typeof alert.severity === 'string' ? alert.severity : 'alert'}`;

  return {
    id,
    pair,
    type: 'VOLATILITY',
    timeframe,
    title,
    message,
    fromPrice: hasFromPrice ? fromPrice : undefined,
    toPrice: hasToPrice ? toPrice : undefined,
    currentPrice: hasToPrice ? toPrice : undefined,
    changePercent: normalizedChange,
    severity: typeof alert.severity === 'string' ? alert.severity.toLowerCase() : undefined,
    triggeredAt,
    minutesAgo: minutesAgoFromIso(triggeredAt),
    velocity: alert.velocity,
    levels: alert.levels,
    confidence: alert.confidence,
    direction,
    priority: typeof alert.priority === 'number' ? alert.priority : undefined,
    confluenceScore: typeof alert.confluenceScore === 'number' ? alert.confluenceScore : undefined,
    confluenceSignals: Array.isArray(alert.confluenceSignals) ? alert.confluenceSignals : undefined,
  };
};

const queryKeyFor = (pair: string | undefined, limit: number) =>
  ['marketAlerts', pair || 'all', limit] as const;

export const useMarketAlerts = (
  opts: { pair?: string; limit?: number; pollMs?: number | null } = {},
) => {
  const { pair, limit = 50 } = opts;
  const resolvedLimit = useMemo(() => clamp(Number(limit) || 50, 1, 200), [limit]);
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeyFor(pair, resolvedLimit), [pair, resolvedLimit]);

  const alertsQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<MarketAlert[]> => {
      const query = `limit=${encodeURIComponent(String(resolvedLimit))}${pair ? `&pair=${encodeURIComponent(pair)}` : ''}`;
      const response = await apiGet<ApiMarketAlertsResponse>(`/api/market/alerts?${query}`);
      const source = Array.isArray(response?.alerts) ? response.alerts : [];

      return source
        .map(normalizeAlert)
        .filter((alert): alert is MarketAlert => Boolean(alert))
        .slice(0, resolvedLimit);
    },
    staleTime: 15000,
    gcTime: 5 * 60 * 1000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const unsubscribe = subscribeToMarketSocket((event) => {
      if (event.type !== 'marketAlert') return;

      const mappedAlert = normalizeAlert(event.data as ApiMarketAlert);
      if (!mappedAlert) return;
      if (pair && mappedAlert.pair !== pair) return;

      queryClient.setQueryData<MarketAlert[]>(queryKey, (currentAlerts = []) => {
        const merged = [mappedAlert, ...currentAlerts.filter((item) => item.id !== mappedAlert.id)];
        return merged.slice(0, resolvedLimit);
      });
    });

    return unsubscribe;
  }, [pair, queryClient, queryKey, resolvedLimit]);

  const alerts = useMemo(
    () =>
      (alertsQuery.data || []).map((alert) => ({
        ...alert,
        minutesAgo: minutesAgoFromIso(alert.triggeredAt),
      })),
    [alertsQuery.data],
  );

  const refetch = useCallback(async () => {
    await alertsQuery.refetch();
  }, [alertsQuery]);

  return {
    alerts,
    loading: alertsQuery.isLoading && alerts.length === 0,
    error: alertsQuery.error instanceof Error ? alertsQuery.error.message : null,
    refetch,
  };
};
