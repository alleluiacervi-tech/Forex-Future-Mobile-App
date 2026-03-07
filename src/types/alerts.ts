export type MarketAlertType = 'PRICE_ALERT' | 'VOLATILITY' | 'MARKET_NEWS';

export interface MarketAlertVelocity {
  signal?: string;
  pipsPerSecond?: number;
  accelerationRatio?: number;
  windowDetected?: string;
}

export interface MarketAlertLevels {
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  riskReward?: number;
}

export interface MarketAlertConfidence {
  label?: string;
  score?: number;
  factors?: string[];
}

export interface MarketAlert {
  id: string;
  pair: string;
  type: MarketAlertType;
  title: string;
  message: string;
  fromPrice?: number;
  toPrice?: number;
  currentPrice?: number;
  direction?: string;
  timeframe?: string;
  changePercent?: number;
  minutesAgo?: number;
  severity?: 'low' | 'medium' | 'high' | string;
  triggeredAt?: string;
  velocity?: MarketAlertVelocity;
  levels?: MarketAlertLevels;
  confidence?: MarketAlertConfidence;
  priority?: number;
  confluenceScore?: number;
  confluenceSignals?: string[];
}
