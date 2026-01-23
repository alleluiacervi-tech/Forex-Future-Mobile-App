import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AIRecommendation } from '../types/ai';
import { apiPost } from '../services/api';

interface ApiRecommendation {
  id?: string;
  pair?: string;
  action?: 'BUY' | 'SELL' | 'WAIT';
  confidence?: number;
  entry?: number | null;
  stopLoss?: number | null;
  takeProfit1?: number | null;
  takeProfit2?: number | null;
  rationale?: string;
}

interface ApiRecommendationResponse {
  recommendation: ApiRecommendation;
}

const mapRecommendation = (
  pair: string,
  timeframe: string,
  recommendation: ApiRecommendation,
): AIRecommendation => {
  const action = recommendation.action ?? 'WAIT';
  const confidence = Number.isFinite(Number(recommendation.confidence))
    ? Number(recommendation.confidence)
    : 0;

  return {
    id: recommendation.id ?? `${pair}-${Date.now()}`,
    pair,
    recommendation: action,
    confidence,
    insight: recommendation.rationale || 'No rationale provided.',
    entryPrice: recommendation.entry ?? undefined,
    targetPrice: recommendation.takeProfit1 ?? recommendation.takeProfit2 ?? undefined,
    stopLoss: recommendation.stopLoss ?? undefined,
    timeframe,
  };
};

interface RecommendationRequest {
  pair: string;
  timeframe?: string;
  currentPrice?: number;
  accountBalance?: number;
  riskPercent?: number;
  notes?: string;
}

const fetchRecommendation = async (payload: RecommendationRequest): Promise<AIRecommendation> => {
  const timeframe = payload.timeframe || '1H';
  const response = await apiPost<ApiRecommendationResponse>('/api/market/recommendations', {
    ...payload,
    timeframe,
  });

  return mapRecommendation(payload.pair, timeframe, response.recommendation);
};

export const useAIRecommendation = (
  pair: string,
  options: Omit<RecommendationRequest, 'pair'> = {},
) => {
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPayload = useMemo(
    () => ({
      pair,
      ...options,
    }),
    [pair, options],
  );

  const fetchData = useCallback(async () => {
    if (!pair) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRecommendation(requestPayload);
      setRecommendation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recommendation');
    } finally {
      setLoading(false);
    }
  }, [pair, requestPayload]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { recommendation, loading, error, refetch: fetchData };
};

export const useAIRecommendations = (
  pairs: string[],
  options: Omit<RecommendationRequest, 'pair'> = {},
) => {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);

  const payloads = useMemo(
    () =>
      pairs.map((pair) => ({
        pair,
        ...options,
      })),
    [pairs, options],
  );

  const fetchAll = useCallback(async () => {
    if (!pairs.length) return;
    const now = Date.now();
    if (now - lastFetchRef.current < 30_000) {
      return;
    }
    lastFetchRef.current = now;
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(payloads.map((payload) => fetchRecommendation(payload)));
      setRecommendations(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  }, [pairs.length, payloads]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { recommendations, loading, error, refetch: fetchAll };
};
