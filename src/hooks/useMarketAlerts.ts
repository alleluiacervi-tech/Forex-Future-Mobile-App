import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet } from '../services/api';
import type { MarketAlert } from '../types/alerts';
import { useInterval } from './useInterval';

type ApiMarketAlert = {
  id: string;
  pair: string;
  windowMinutes: number;
  fromPrice: number;
  toPrice: number;
  changePercent: number;
  severity?: string;
  triggeredAt: string;
  createdAt?: string;
};

type ApiMarketAlertsResponse = {
  alerts: ApiMarketAlert[];
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const windowLabel = (windowMinutes: number) => {
  if (windowMinutes === 60) return '1h';
  if (windowMinutes === 240) return '4h';
  if (windowMinutes === 1440) return '1d';
  if (windowMinutes % 60 === 0) return `${windowMinutes / 60}h`;
  return `${windowMinutes}m`;
};

const decimalsForPair = (pair: string) => (pair.includes('JPY') ? 3 : 5);

const formatPairPrice = (pair: string, price: number) => {
  const decimals = decimalsForPair(pair);
  return Number.isFinite(Number(price)) ? Number(price).toFixed(decimals) : String(price);
};

const minutesAgoFromIso = (iso: string) => {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return undefined;
  return Math.max(0, Math.round((Date.now() - ts) / 60000));
};

const mapApiAlert = (alert: ApiMarketAlert): MarketAlert => {
  const window = windowLabel(alert.windowMinutes);
  const change = Number(alert.changePercent);
  const sign = change >= 0 ? '+' : '';
  const abs = Math.abs(change);
  const direction = change >= 0 ? 'up' : 'down';

  return {
    id: alert.id,
    pair: alert.pair,
    type: 'VOLATILITY',
    timeframe: window,
    changePercent: change,
    severity: alert.severity,
    triggeredAt: alert.triggeredAt,
    minutesAgo: minutesAgoFromIso(alert.triggeredAt),
    title: `Big move: ${alert.pair} ${sign}${abs.toFixed(2)}% (${window})`,
    message: `${alert.pair} moved ${direction} from ${formatPairPrice(alert.pair, alert.fromPrice)} to ${formatPairPrice(alert.pair, alert.toPrice)} (${sign}${abs.toFixed(2)}%) in ${window}.`,
  };
};

export const useMarketAlerts = (
  opts: { pair?: string; limit?: number; pollMs?: number | null } = {},
) => {
  const { pair, limit = 50, pollMs = 15000 } = opts;
  const resolvedLimit = useMemo(() => clamp(Number(limit) || 50, 1, 200), [limit]);

  const [alerts, setAlerts] = useState<MarketAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      setError(null);
      if (alerts.length === 0) setLoading(true);
      const query = `limit=${encodeURIComponent(String(resolvedLimit))}${pair ? `&pair=${encodeURIComponent(pair)}` : ''}`;
      const response = await apiGet<ApiMarketAlertsResponse>(`/api/market/alerts?${query}`);
      const mapped = (response.alerts || []).map(mapApiAlert);
      setAlerts(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [alerts.length, pair, resolvedLimit]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useInterval(() => {
    fetchAlerts();
  }, pollMs);

  return { alerts, loading, error, refetch: fetchAlerts };
};
