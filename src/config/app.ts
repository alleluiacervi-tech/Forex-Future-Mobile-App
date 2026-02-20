import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_API_PORT = process.env.EXPO_PUBLIC_API_PORT || '4000';

const parseHost = (value?: string | null): string | null => {
  if (!value) return null;
  const input = value.trim();
  if (!input) return null;

  try {
    const normalized = input.includes('://') ? input : `http://${input}`;
    return new URL(normalized).hostname || null;
  } catch {
    return input.replace(/^https?:\/\//i, '').split('/')[0]?.split(':')[0] || null;
  }
};

const isIpv4 = (value: string) => {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
};

const isLoopbackHost = (value: string) => value === 'localhost' || value === '127.0.0.1' || value === '::1';

const isTunnelHost = (value: string) =>
  value.endsWith('exp.direct') || value.endsWith('expo.dev') || value.includes('tunnel');

const getExpoDebugHost = (): string | null => {
  const manifest = Constants.manifest as { debuggerHost?: string } | null;
  const candidates = [Constants.expoGoConfig?.debuggerHost, Constants.expoConfig?.hostUri, manifest?.debuggerHost];

  for (const candidate of candidates) {
    const host = parseHost(candidate);
    if (host) return host;
  }

  return null;
};

const resolveLocalApiUrl = () => {
  const debugHost = getExpoDebugHost();
  if (debugHost && isIpv4(debugHost) && !isLoopbackHost(debugHost)) {
    return `http://${debugHost}:${DEFAULT_API_PORT}`;
  }

  return (
    Platform.select({
      android: `http://10.0.2.2:${DEFAULT_API_PORT}`,
      ios: `http://localhost:${DEFAULT_API_PORT}`,
      default: `http://localhost:${DEFAULT_API_PORT}`,
    }) ?? `http://localhost:${DEFAULT_API_PORT}`
  );
};

const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const localApiUrl = resolveLocalApiUrl();
const resolvedApiUrl = envApiUrl || localApiUrl;

if (__DEV__ && !envApiUrl) {
  const debugHost = getExpoDebugHost();
  if (debugHost && isTunnelHost(debugHost)) {
    console.warn(
      `[Config] Expo tunnel detected (${debugHost}). Expo tunnel does not expose your backend API. Set EXPO_PUBLIC_API_URL to a reachable backend URL (typically HTTPS tunnel), then restart Expo.`,
    );
  } else if (!debugHost || isLoopbackHost(debugHost)) {
    console.warn(
      '[Config] EXPO_PUBLIC_API_URL is not set. On a physical device, localhost will fail. Use EXPO_PUBLIC_API_URL=http://<your-lan-ip>:4000 or an HTTPS backend URL.',
    );
  }
}

if (__DEV__ && envApiUrl) {
  const envHost = parseHost(envApiUrl);
  if (envHost && isLoopbackHost(envHost) && Platform.OS !== 'web') {
    console.warn(
      `[Config] EXPO_PUBLIC_API_URL is set to ${envApiUrl}. localhost/127.0.0.1 is only valid on emulator/simulator, not a physical device.`,
    );
  }
}

export const APP_CONFIG = {
  name: 'Forex Trading App',
  version: '1.0.0',
  apiUrl: resolvedApiUrl,
  refreshInterval: 5000, // 5 seconds
  defaultLotSize: 0.01,
  maxLotSize: 100,
  minLotSize: 0.01,
  defaultLeverage: 100,
} as const;
