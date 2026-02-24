import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  change?: number;
  changePercent?: number;
  accountBalance?: number;
  riskPercent?: number;
  notes?: string;
}

interface RecommendationResult {
  recommendation: AIRecommendation;
  error?: string;
}

// Professional local fallback recommendation using technical heuristics
const createFallbackRecommendation = (
  pair: string,
  timeframe: string,
  currentPrice?: number,
  change?: number,
  changePercent?: number,
): AIRecommendation => {
  const momentum = changePercent || 0;
  const absMomentum = Math.abs(momentum);
  const volatility = absMomentum > 0.15 ? 'high' : absMomentum > 0.05 ? 'moderate' : 'low';

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

  const confidence = Math.min(0.92, 0.52 + absMomentum * 4 + (volatility === 'high' ? 0.08 : 0));

  const price = currentPrice || 1.0;
  const entry = price * (1 + (action === 'BUY' ? -0.0004 : action === 'SELL' ? 0.0004 : 0));
  const stopLossDistance = volatility === 'high' ? 0.006 : volatility === 'moderate' ? 0.008 : 0.01;
  const stopLoss =
    action === 'BUY'
      ? entry * (1 - stopLossDistance)
      : action === 'SELL'
        ? entry * (1 + stopLossDistance)
        : entry;
  const takeProfitDistance = stopLossDistance * 1.5;
  const takeProfit =
    action === 'BUY'
      ? entry * (1 + takeProfitDistance)
      : action === 'SELL'
        ? entry * (1 - takeProfitDistance)
        : entry;

  const macroContext = momentum > 0 ? 'risk-on sentiment' : 'safe-haven flows';
  const technicalBias = absMomentum > 0.1 ? 'strong directional bias' : 'range-bound environment';
  const riskReward = `1:1.5`;
  const positionSizing = volatility === 'high' ? 'reduce size, widen stops' : 'standard sizing, tight stops';
  const insight = `${action} — ${rationale} Macro: ${macroContext}. Technical: ${technicalBias}. Entry ${entry.toFixed(5)}; SL ${stopLoss.toFixed(5)}; TP ${takeProfit.toFixed(5)} (RR ${riskReward}). Position: ${positionSizing}. Await confirmation on order flow before execution.`;

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
    rationale: `${action} based on ${absMomentum > 0.1 ? 'strong' : 'moderate'} momentum (${(
      momentum * 100
    ).toFixed(2)}%) and ${volatility} volatility regime.`,
    invalidation: `Price moves ${action === 'BUY' ? 'below' : 'above'} ${stopLoss.toFixed(
      5,
    )} or momentum reverses sharply.`,
    assumptions: 'No major news events; normal liquidity; analysis based on recent price action.',
    keyLevels: [entry, stopLoss, takeProfit],
    validityMinutes: 120,
  };
};

const fetchRecommendation = async (payload: RecommendationRequest): Promise<RecommendationResult> => {
  const timeframe = payload.timeframe || '1H';
  try {
    const response = await apiPost<ApiRecommendationResponse>('/api/market/recommendations', {
      ...payload,
      timeframe,
    });
    return { recommendation: mapRecommendation(payload.pair, timeframe, response.recommendation) };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch recommendation';
    return {
      recommendation: createFallbackRecommendation(
        payload.pair,
        timeframe,
        payload.currentPrice,
        payload.change,
        payload.changePercent,
      ),
      error: message,
    };
  }
};

const recommendationKey = (payload: RecommendationRequest) => [
  'aiRecommendation',
  payload.pair,
  payload.timeframe || '1H',
  payload.currentPrice ?? null,
  payload.change ?? null,
  payload.changePercent ?? null,
  payload.accountBalance ?? null,
  payload.riskPercent ?? null,
  payload.notes ?? null,
] as const;

export const useAIRecommendation = (
  pair: string,
  options: Omit<RecommendationRequest, 'pair'> = {},
) => {
  const {
    timeframe,
    currentPrice,
    change,
    changePercent,
    accountBalance,
    riskPercent,
    notes,
  } = options;

  const requestPayload = useMemo(
    () => ({
      pair,
      timeframe,
      currentPrice,
      change,
      changePercent,
      accountBalance,
      riskPercent,
      notes,
    }),
    [accountBalance, change, changePercent, currentPrice, notes, pair, riskPercent, timeframe],
  );

  const query = useQuery({
    queryKey: recommendationKey(requestPayload),
    queryFn: () => fetchRecommendation(requestPayload),
    enabled: Boolean(pair),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    recommendation: query.data?.recommendation ?? null,
    loading: query.isLoading || (query.isFetching && !query.data),
    error:
      query.error instanceof Error
        ? query.error.message
        : query.data?.error || null,
    refetch,
  };
};

export const useAIRecommendations = (
  pairs: string[],
  options: Omit<RecommendationRequest, 'pair'> = {},
) => {
  const {
    timeframe,
    currentPrice,
    change,
    changePercent,
    accountBalance,
    riskPercent,
    notes,
  } = options;

  const payloads = useMemo(
    () =>
      pairs.map((pair) => ({
        pair,
        timeframe,
        currentPrice,
        change,
        changePercent,
        accountBalance,
        riskPercent,
        notes,
      })),
    [accountBalance, change, changePercent, currentPrice, notes, pairs, riskPercent, timeframe],
  );

  const query = useQuery({
    queryKey: [
      'aiRecommendations',
      payloads.map((payload) => recommendationKey(payload)),
    ] as const,
    queryFn: async () => Promise.all(payloads.map((payload) => fetchRecommendation(payload))),
    enabled: payloads.length > 0,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const recommendations = useMemo(
    () => (query.data || []).map((item) => item.recommendation),
    [query.data],
  );

  const fallbackError = useMemo(
    () => (query.data || []).find((item) => item.error)?.error || null,
    [query.data],
  );

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    recommendations,
    loading: query.isLoading || (query.isFetching && recommendations.length === 0),
    error: query.error instanceof Error ? query.error.message : fallbackError,
    refetch,
  };
};
