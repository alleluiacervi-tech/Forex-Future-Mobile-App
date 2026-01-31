import { APP_CONFIG } from '../config';

const baseUrl = APP_CONFIG.apiUrl.replace(/\/$/, '');

const buildUrl = (path: string) => (path.startsWith('http') ? path : `${baseUrl}${path}`);

const extractErrorMessage = (errorText: string, status: number) => {
  if (!errorText) return `Request failed with ${status}`;
  try {
    const parsed = JSON.parse(errorText);
    if (typeof parsed?.error === 'string') return parsed.error;
    if (typeof parsed?.error?.message === 'string') return parsed.error.message;
    if (typeof parsed?.message === 'string') return parsed.message;
  } catch (_) {
    // ignore JSON parse errors
  }
  return errorText || `Request failed with ${status}`;
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

  return response.json() as Promise<T>;
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

  return response.json() as Promise<T>;
}
