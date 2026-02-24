import { APP_CONFIG } from '../config';

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

export async function apiPost<T>(
  path: string,
  body: unknown,
  options: { token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const message = extractErrorMessage(errorText, response.status);
    throw new Error(message);
  }

  return parseResponseBody<T>(response);
}
