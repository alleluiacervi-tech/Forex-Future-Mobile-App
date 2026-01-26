import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AIRecommendation } from '../types/ai';
import { apiPost } from '../services/api';
import { debounce } from '../utils/helpers';

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
  change?: number;
  changePercent?: number;
  accountBalance?: number;
  riskPercent?: number;
  notes?: string;
}

// Professional local fallback recommendation using technical heuristics
const createFallbackRecommendation = (
  pair: string,
  timeframe: string,
  currentPrice?: number,
  change?: number,
  changePercent?: number,
): AIRecommendation => {
  // Heuristic: RSI-like momentum from changePercent
  const momentum = changePercent || 0;
  const absMomentum = Math.abs(momentum);
  // Simple volatility estimate from recent change magnitude
  const volatility = absMomentum > 0.15 ? 'high' : absMomentum > 0.05 ? 'moderate' : 'low';

  // Determine action based on momentum and volatility
  let action: 'BUY' | 'SELL' | 'WAIT';
  let rationale: string;
  if (absMomentum > 0.1) {
    action = momentum > 0 ? 'BUY' : 'SELL';
    rationale = `Strong ${momentum > 0 ? 'upward' : 'downward'} momentum detected (${momentum.toFixed(2)}%).`;
  } else if (absMomentum > 0.03) {
    action = momentum > 0 ? 'BUY' : 'SELL';
    rationale = `Moderate ${momentum > 0 ? 'bullish' : 'bearish'} bias (${momentum.toFixed(2)}%).`;
  } else {
    action = 'WAIT';
    rationale = 'Price consolidating; lack of clear directional bias.';
  }

  // Confidence based on momentum strength and volatility
  const confidence = Math.min(0.92, 0.52 + absMomentum * 4 + (volatility === 'high' ? 0.08 : 0));

  const price = currentPrice || 1.0;
  // Entry: slight pullback for BUY, slight bounce for SELL
  const entry = price * (1 + (action === 'BUY' ? -0.0004 : action === 'SELL' ? 0.0004 : 0));
  // Stop loss: tight for high volatility, wider for low
  const stopLossDistance = volatility === 'high' ? 0.006 : volatility === 'moderate' ? 0.008 : 0.01;
  const stopLoss = action === 'BUY' ? entry * (1 - stopLossDistance) : action === 'SELL' ? entry * (1 + stopLossDistance) : entry;
  // Take profit: risk/reward ~1:1.5
  const takeProfitDistance = stopLossDistance * 1.5;
  const takeProfit = action === 'BUY' ? entry * (1 + takeProfitDistance) : action === 'SELL' ? entry * (1 - takeProfitDistance) : entry;

  // Professional insight template
  const insight = `${action} — ${rationale} Volatility: ${volatility}. Entry at ${entry.toFixed(5)}; SL ${stopLoss.toFixed(5)}; TP ${takeProfit.toFixed(5)}. Consider confirming with additional indicators before execution.`;

  return {
    id: `${pair}-fallback-${Date.now()}`,
    pair,
    recommendation: action,
    confidence,
    insight,
    entryPrice: entry,
    targetPrice: takeProfit,
    stopLoss,
    timeframe,
  };
};

const fetchRecommendation = async (payload: RecommendationRequest): Promise<AIRecommendation> => {
  const timeframe = payload.timeframe || '1H';
  try {
    const response = await apiPost<ApiRecommendationResponse>('/api/market/recommendations', {
      ...payload,
      timeframe,
    });
    return mapRecommendation(payload.pair, timeframe, response.recommendation);
  } catch (err) {
    // If API fails (e.g., quota), return a local fallback
    console.warn('[AI] API failed, using fallback recommendation:', err);
    return createFallbackRecommendation(
      payload.pair,
      timeframe,
      payload.currentPrice,
      payload.change,
      payload.changePercent,
    );
  }
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

  const fetchData = useCallback(
    debounce(async () => {
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
    }, 1500), // 1.5s debounce
    [pair, requestPayload],
  );

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
