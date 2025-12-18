export type RecommendationType = 'BUY' | 'SELL' | 'WAIT';

export interface AIRecommendation {
  id: string;
  pair: string;
  recommendation: RecommendationType;
  confidence: number;
  insight: string;
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  timeframe: string;
}