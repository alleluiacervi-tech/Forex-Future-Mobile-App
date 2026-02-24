export type MarketAlertType = 'PRICE_ALERT' | 'VOLATILITY' | 'MARKET_NEWS';

export interface PriceLevel {
  entry: number;
  stopLoss: number;
  takeProfit: number;
  slPips: number;
  tpPips: number;
  riskReward: number;
}

export interface ConfidenceMetrics {
  score: number;
  label: string;
  factors: string[];
}

export interface VelocityMetrics {
  signal: string;
  pipsPerSecond: number;
  accelerationRatio: number;
  windowDetected: string;
  direction: string;
}

export interface MarketAlert {
  id: string;
  pair: string;
  type: MarketAlertType;
  title: string;
  message: string;
  timeframe?: string;
  changePercent?: number;
  minutesAgo?: number;
  severity?: 'low' | 'medium' | 'high' | string;
  triggeredAt?: string;
  fromPrice?: number;
  toPrice?: number;
  currentPrice?: number;
  confidence?: ConfidenceMetrics;
  velocity?: VelocityMetrics;
  levels?: PriceLevel;
  direction?: 'BUY' | 'SELL';
}
