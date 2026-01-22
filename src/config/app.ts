import { Platform } from 'react-native';

const localApiUrl =
  Platform.select({
    android: 'http://10.0.2.2:4000',
    ios: 'http://localhost:4000',
    default: 'http://localhost:4000',
  }) ?? 'http://localhost:4000';

export const APP_CONFIG = {
  name: 'Forex Trading App',
  version: '1.0.0',
  apiUrl: process.env.EXPO_PUBLIC_API_URL || localApiUrl,
  refreshInterval: 5000, // 5 seconds
  defaultLotSize: 0.01,
  maxLotSize: 100,
  minLotSize: 0.01,
  defaultLeverage: 100,
} as const;
