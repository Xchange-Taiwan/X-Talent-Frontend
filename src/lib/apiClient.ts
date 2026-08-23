import type { Session } from 'next-auth';

import { captureApiFailure } from '@/lib/monitoring';

import { singleFlight } from './singleFlight';

let sessionGetter: () => Promise<Session | null> = () => Promise.resolve(null);

export function setSessionGetter(getter: () => Promise<Session | null>) {
  sessionGetter = getter;
}

// ─── Custom Errors ───────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class FetchHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string
  ) {
    super(`fetch ${path} failed: ${status}`);
    this.name = 'FetchHttpError';
  }
}

export class FetchApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly msg: string,
    public readonly path: string
  ) {
    super(`fetch ${path} API error (${code}): ${msg}`);
    this.name = 'FetchApiError';
  }
}

// SSR_API_URL is preferred when set, so server-side fetches inside a
// Docker container can reach the BFF via the docker network DNS name
// (e.g. http://bff:8000/api), while the browser bundle still uses
// NEXT_PUBLIC_API_URL (e.g. http://localhost:8006/api).
export const BASE_URL =
  process.env.SSR_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';

export type RequestOptions = Omit<RequestInit, 'body' | 'headers'> & {
  /** Attach Bearer token from NextAuth session. Respects JWT_ENABLED flag. Default: true */
  auth?: boolean;
  /** Query string params — undefined/null values are omitted */
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Extra headers merged on top of defaults */
  headers?: Record<string, string>;
  /** Treat `path` as a local Next.js API route — skip prefixing BASE_URL. Default: false */
  isLocal?: boolean;
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

// Deduplicate concurrent session lookups. `sessionGetter` (next-auth's
// imperative `getSession()`) always issues a fresh, uncached network
// request - unlike the `useSession()` hook, it doesn't share the
// SessionProvider's client-side state. A page that fires several
// authenticated requests at once (e.g. loading multiple lists in
// parallel) would otherwise trigger one `/api/auth/session` round trip
// per request; singleFlight collapses concurrent callers onto the same
// in-flight lookup so only the slowest response in a burst is paid once.
//
// Routine lookups and 401 refreshes use separate maps rather than sharing
// one: a 401 refresh must always start a lookup that begins *after* the
// 401 was observed. If it instead joined a routine lookup already in
// flight (started before the 401 happened), it could get back the same
// stale token that just failed, retry with it, and 401 again.
const sessionLookupMap = new Map<'session', Promise<Session | null>>();
const refreshMap = new Map<'refresh', Promise<Session | null>>();

function getSharedSession(): Promise<Session | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  return singleFlight(sessionLookupMap, 'session', () => sessionGetter());
}

function refreshSession(): Promise<Session | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  // Once a refresh completes, drop any routine lookup entry so the 401
  // handler's retry (which calls getAuthHeader() -> getSharedSession())
  // is forced to start a fresh lookup instead of possibly joining a
  // routine lookup that was already in flight before the refresh even
  // started, and could still resolve to the pre-refresh, stale token.
  return singleFlight(refreshMap, 'refresh', () => sessionGetter()).finally(
    () => {
      sessionLookupMap.delete('session');
    }
  );
}

function isAbsoluteUrl(path: string): boolean {
  // Also matches protocol-relative URLs (e.g. //evil.com) — without this,
  // the browser would resolve them as external, but this check would treat
  // them as internal and attach the user's auth token to them.
  return /^(?:https?:)?\/\//i.test(path);
}

function buildUrl(
  path: string,
  params?: RequestOptions['params'],
  isLocal = false
): string {
  const url = isAbsoluteUrl(path) || isLocal ? path : `${BASE_URL}${path}`;
  if (!params) return url;

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value));
    }
  });

  const qs = query.toString();
  return qs ? `${url}?${qs}` : url;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  const session = await getSharedSession();
  const token = session?.accessToken;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
  isRetry = false
): Promise<T> {
  const {
    auth = true,
    headers = {},
    params,
    signal,
    isLocal = false,
    ...restOptions
  } = options;

  // Never attach the user's session token to an absolute external URL —
  // only relative paths (our own backend) are trusted to receive it.
  const effectiveAuth = auth && !isAbsoluteUrl(path);

  if (typeof window === 'undefined' && effectiveAuth) {
    throw new Error(
      'Server-side authenticated requests are not supported. Use auth: false.'
    );
  }

  const authHeader = effectiveAuth ? await getAuthHeader() : {};

  const startTime = Date.now();
  let response: Response;

  try {
    response = await fetch(buildUrl(path, params, isLocal), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
      ...restOptions,
    });
  } catch (networkError) {
    // Caller-driven cancellation — not an error worth reporting.
    if (isAbortError(networkError)) {
      throw networkError;
    }
    // fetch() itself threw — DNS failure, connection refused, timeout, etc.
    captureApiFailure({
      endpoint: path,
      method,
      status: 0,
      message:
        networkError instanceof Error ? networkError.message : 'Network error',
      duration: Date.now() - startTime,
    });
    throw networkError;
  }

  if (response.status === 401 && auth && !isRetry) {
    const freshSession = await refreshSession();
    if (freshSession?.accessToken && !freshSession.error) {
      return request<T>(method, path, body, options, true);
    }
  }

  if (!response.ok) {
    if (
      response.status === 503 &&
      response.headers.get('X-Maintenance-Mode') === '1' &&
      typeof window !== 'undefined'
    ) {
      window.location.href = '/maintenance';
      return new Promise(() => {}); // Pause further execution during redirect
    }

    const errorBody = await response.json().catch(() => ({}));
    const message =
      (errorBody as Record<string, string>).msg ||
      (errorBody as Record<string, string>).message ||
      `Request failed with status ${response.status}`;
    captureApiFailure({
      endpoint: path,
      method,
      status: response.status,
      message,
      duration: Date.now() - startTime,
    });
    throw new ApiError(response.status, message, errorBody);
  }

  // Handle 204 No Content and other empty responses
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  const parsed = JSON.parse(text) as T;
  return parsed;
}

// ─── Public API ──────────────────────────────────────────────────────────────
export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>('GET', path, undefined, options),

  getUnwrapped: async <T>(
    path: string,
    options?: RequestOptions
  ): Promise<T | null | undefined> => {
    const result = await request<{
      code: string;
      msg: string;
      data: T | null | undefined;
    }>('GET', path, undefined, options);

    if (result.code !== '0') {
      throw new FetchApiError(result.code, result.msg, path);
    }

    return result.data;
  },

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, body, options),

  postUnwrapped: async <T>(
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T | null | undefined> => {
    const result = await request<{
      code: string;
      msg: string;
      data: T | null | undefined;
    }>('POST', path, body, options);

    if (result.code !== '0') {
      throw new FetchApiError(result.code, result.msg, path);
    }

    return result.data;
  },

  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, body, options),

  putUnwrapped: async <T>(
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T | null | undefined> => {
    const result = await request<{
      code: string;
      msg: string;
      data: T | null | undefined;
    }>('PUT', path, body, options);

    if (result.code !== '0') {
      throw new FetchApiError(result.code, result.msg, path);
    }

    return result.data;
  },

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, body, options),

  patchUnwrapped: async <T>(
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T | null | undefined> => {
    const result = await request<{
      code: string;
      msg: string;
      data: T | null | undefined;
    }>('PATCH', path, body, options);

    if (result.code !== '0') {
      throw new FetchApiError(result.code, result.msg, path);
    }

    return result.data;
  },

  delete: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('DELETE', path, body, options),

  deleteUnwrapped: async <T>(
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T | null | undefined> => {
    const result = await request<{
      code: string;
      msg: string;
      data: T | null | undefined;
    }>('DELETE', path, body, options);

    if (result.code !== '0') {
      throw new FetchApiError(result.code, result.msg, path);
    }

    return result.data;
  },

  getExternalBlob: async (
    url: string,
    options?: RequestOptions
  ): Promise<Blob> => {
    const { signal, ...restOptions } = options ?? {};
    const response = await fetch(url, {
      method: 'GET',
      ...(signal ? { signal } : {}),
      ...restOptions,
    });
    if (!response.ok) {
      throw new Error(`fetch external blob failed: ${response.status}`);
    }
    return response.blob();
  },
};

// ─── Shared Server Helper ────────────────────────────────────────────────────
export async function fetchServerJson<T>(
  path: string,
  options?: RequestOptions
): Promise<T | null | undefined> {
  const { auth = false, ...rest } = options ?? {};
  try {
    return await apiClient.getUnwrapped<T>(path, { auth, ...rest });
  } catch (error) {
    if (error instanceof ApiError) {
      throw new FetchHttpError(error.status, path);
    }
    throw error;
  }
}
