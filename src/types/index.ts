// Market types
export interface CurrencyPair {
  id: string;
  symbol: string;
  base: string;
  quote: string;
  price: number;
  change: number;
  changePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

export interface Trade {
  id: string;
  pair: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  timestamp: Date;
  profit?: number;
}

export interface Portfolio {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  openPositions: number;
  totalProfit: number;
}

export interface ChartData {
  labels: string[];
  datasets: {
    data: number[];
    color?: (opacity: number) => string;
    strokeWidth?: number;
  }[];
}

// Navigation types
export type RootStackParamList = {
  Main: undefined;
  ChartDetail: { pair: string };
  TradeDetail: { pair: string };
  CurrencyDetail: { pair: string };
};

export type MainTabParamList = {
  Home: undefined;
  Market: undefined;
  Notifications: undefined;
  Profile: undefined;
};

// Re-export from other type files
export * from './navigation';
export * from './market';
export * from './components';

