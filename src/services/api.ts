import { APP_CONFIG } from '../config';

const baseUrl = APP_CONFIG.apiUrl.replace(/\/$/, '');

const buildUrl = (path: string) => (path.startsWith('http') ? path : `${baseUrl}${path}`);

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(buildUrl(path), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const message = errorText || `Request failed with ${response.status}`;
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
    const message = errorText || `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
