import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from '../config';
import { resetToLanding } from '../navigation/rootNavigation'; // ADDED: for session expiry redirect

const TOKEN_KEY = '@forexapp_token';
// ADDED: refresh token storage key
export const REFRESH_TOKEN_KEY = '@forexapp_refresh_token';
const baseUrl = APP_CONFIG.apiUrl.replace(/\/$/, '');

const buildUrl = (path: string) => (path.startsWith('http') ? path : `${baseUrl}${path}`);

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: { message?: string } | string;
  message?: string;
};

const extractErrorMessage = (errorText: string, status: number) => {
  if (!errorText) return `Request failed with ${status}`;
  try {
    const parsed = JSON.parse(errorText);
    if (parsed && typeof parsed === 'object' && parsed.success === false) {
      if (typeof parsed?.error === 'string') return parsed.error;
      if (typeof parsed?.error?.message === 'string') return parsed.error.message;
      if (typeof parsed?.message === 'string') return parsed.message;
    }
    if (typeof parsed?.error === 'string') return parsed.error;
    if (typeof parsed?.error?.message === 'string') return parsed.error.message;
    if (typeof parsed?.message === 'string') return parsed.message;
  } catch (_) {
    // ignore JSON parse errors
  }
  return errorText || `Request failed with ${status}`;
};

const unwrapApiResponse = <T>(payload: unknown): T => {
  if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'success')) {
    const envelope = payload as ApiEnvelope<T>;
    if (envelope.success === false) {
      const message =
        typeof envelope.error === 'string'
          ? envelope.error
          : typeof envelope.error?.message === 'string'
            ? envelope.error.message
            : envelope.message || 'Request failed.';
      throw new Error(message);
    }

    if (Object.prototype.hasOwnProperty.call(envelope, 'data')) {
      return envelope.data as T;
    }
  }

  return payload as T;
};

const parseResponseBody = async <T>(response: Response): Promise<T> => {
  const text = await response.text().catch(() => '');
  if (!text) {
    return null as T;
  }

  try {
    const parsed = JSON.parse(text);
    return unwrapApiResponse<T>(parsed);
  } catch {
    return text as unknown as T;
  }
};

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(buildUrl(path), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const message = extractErrorMessage(errorText, response.status);
    throw new Error(message);
  }

  return parseResponseBody<T>(response);
}

const getStoredToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const buildAuthHeaders = async (token?: string): Promise<Record<string, string>> => {
  const resolved = token ?? (await getStoredToken());
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (resolved) {
    headers.Authorization = `Bearer ${resolved}`;
  }
  return headers;
};

// ADDED: automatic token refresh on 401
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) return null;

      const response = await fetch(buildUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (data?.token) {
        await AsyncStorage.setItem(TOKEN_KEY, data.token);
        if (data.refreshToken) {
          await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
        }
        return data.token as string;
      }
      return null;
    } catch {
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// ADDED: handle expired session — clear storage and navigate to login
async function handleSessionExpired(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, '@forexapp_user']).catch(() => {});
  resetToLanding();
}

// FIX: helper to handle 401 with refresh retry for any auth request
async function handleAuthResponse<T>(
  response: Response,
  retryFetch: (newToken: string) => Promise<Response>,
  hasExplicitToken: boolean,
): Promise<T> {
  if (response.status === 401 && !hasExplicitToken) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      const retryResponse = await retryFetch(newToken);
      if (!retryResponse.ok) {
        const errorText = await retryResponse.text().catch(() => '');
        throw new Error(extractErrorMessage(errorText, retryResponse.status));
      }
      return parseResponseBody<T>(retryResponse);
    }
    await handleSessionExpired();
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(extractErrorMessage(errorText, response.status));
  }

  return parseResponseBody<T>(response);
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  options: { token?: string } = {},
): Promise<T> {
  const headers = await buildAuthHeaders(options.token);
  const url = buildUrl(path);
  const bodyStr = JSON.stringify(body ?? {});

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: bodyStr,
  });

  // FIX: handle 401 with automatic token refresh
  return handleAuthResponse<T>(
    response,
    async (newToken) => fetch(url, { method: 'POST', headers: await buildAuthHeaders(newToken), body: bodyStr }),
    !!options.token,
  );
}

export async function apiAuthGet<T>(path: string, options: { token?: string } = {}): Promise<T> {
  const headers = await buildAuthHeaders(options.token);
  const url = buildUrl(path);

  const response = await fetch(url, { headers });

  // FIX: handle 401 with automatic token refresh
  return handleAuthResponse<T>(
    response,
    async (newToken) => fetch(url, { headers: await buildAuthHeaders(newToken) }),
    !!options.token,
  );
}

export { apiPost as apiAuthPost };

export async function apiAuthPut<T>(
  path: string,
  body: unknown,
  options: { token?: string } = {},
): Promise<T> {
  const headers = await buildAuthHeaders(options.token);
  const url = buildUrl(path);
  const bodyStr = JSON.stringify(body ?? {});

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: bodyStr,
  });

  // FIX: handle 401 with automatic token refresh
  return handleAuthResponse<T>(
    response,
    async (newToken) => fetch(url, { method: 'PUT', headers: await buildAuthHeaders(newToken), body: bodyStr }),
    !!options.token,
  );
}

export async function apiAuthDelete<T>(
  path: string,
  options: { token?: string } = {},
): Promise<T> {
  const headers = await buildAuthHeaders(options.token);
  const url = buildUrl(path);

  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  });

  return handleAuthResponse<T>(
    response,
    async (newToken) => fetch(url, { method: 'DELETE', headers: await buildAuthHeaders(newToken) }),
    !!options.token,
  );
}
