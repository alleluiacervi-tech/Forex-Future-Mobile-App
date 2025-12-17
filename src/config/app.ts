export const APP_CONFIG = {
  name: 'Forex Trading App',
  version: '1.0.0',
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.example.com',
  refreshInterval: 5000, // 5 seconds
  defaultLotSize: 0.01,
  maxLotSize: 100,
  minLotSize: 0.01,
  defaultLeverage: 100,
} as const;

