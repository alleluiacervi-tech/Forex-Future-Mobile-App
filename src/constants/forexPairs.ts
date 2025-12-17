import { CurrencyPair } from '../types/market';

export const MAJOR_PAIRS: string[] = [
  'EUR/USD',
  'GBP/USD',
  'USD/JPY',
  'USD/CHF',
  'AUD/USD',
  'USD/CAD',
  'NZD/USD',
];

export const MINOR_PAIRS: string[] = [
  'EUR/GBP',
  'EUR/JPY',
  'GBP/JPY',
  'AUD/JPY',
  'EUR/AUD',
];

export const EXOTIC_PAIRS: string[] = [
  'USD/ZAR',
  'USD/TRY',
  'USD/MXN',
  'EUR/TRY',
  'GBP/ZAR',
];

export const ALL_PAIRS = [
  ...MAJOR_PAIRS,
  ...MINOR_PAIRS,
  ...EXOTIC_PAIRS,
];

