export type MarketAlertType = 'PRICE_ALERT' | 'VOLATILITY' | 'MARKET_NEWS';

export interface MarketAlert {
  id: string;
  pair: string;
  type: MarketAlertType;
  title: string;
  message: string;
  timeframe?: string;
  changePercent?: number;
  minutesAgo?: number;
}
