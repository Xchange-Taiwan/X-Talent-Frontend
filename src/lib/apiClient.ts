import type { Session } from 'next-auth';

import { resolveBffBaseUrl } from '@/lib/auth/bffAuth';
import { isAbortError } from '@/lib/errorUtils';
import { captureApiFailure } from '@/lib/monitoring';

import { singleFlight } from './singleFlight';

let sessionGetter: () => Promise<Session | null> = () => Promise.resolve(null);
let onRefreshTokenErrorHandler: (() => Promise<void> | void) | null = null;

export function setSessionGetter(getter: () => Promise<Session | null>) {
  sessionGetter = getter;
}

export function setOnRefreshTokenError(
  handler: (() => Promise<void> | void) | null
) {
  onRefreshTokenErrorHandler = handler;
}

// ─── Custom Errors ───────────────────────────────────────────────────────────
export class ApiError<TData = unknown> extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly data?: TData,
    public readonly detail?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeErrorCode(code: unknown): string | undefined {
  if (code === undefined || code === null || typeof code === 'object') {
    return undefined;
  }
  return String(code);
}

function sanitizeEndpointPath(path: string): string {
  const queryOrHashIndex = path.search(/[?#]/);
  return queryOrHashIndex === -1 ? path : path.slice(0, queryOrHashIndex);
}

function extractFastApiDetailMessage(detail: unknown): string | undefined {
  if (typeof detail === 'string' && detail.trim().length > 0) {
    return detail.trim();
  }
  if (!Array.isArray(detail) || detail.length === 0) {
    return undefined;
  }
  const parts = detail
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim();
      }
      if (!isPlainRecord(item)) {
        return '';
      }
      const msg = typeof item.msg === 'string' ? item.msg.trim() : '';
      const loc = Array.isArray(item.loc)
        ? item.loc
            .filter(
              (seg) =>
                (typeof seg === 'string' || typeof seg === 'number') &&
                seg !== 'body'
            )
            .join('.')
        : '';
      return loc && msg ? `${loc}: ${msg}` : msg;
    })
    .filter(Boolean);

  return parts.length > 0 ? parts.join('; ') : undefined;
}

function extractNestedDataMessage(data: unknown): string | undefined {
  if (!isPlainRecord(data)) {
    return undefined;
  }
  const msg = data.message;
  return typeof msg === 'string' && msg.trim().length > 0
    ? msg.trim()
    : undefined;
}

class MaintenanceError extends Error {
  constructor() {
    super('Maintenance mode');
    this.name = 'MaintenanceError';
  }
}

interface ApiResponseEnvelope<T> {
  code: string | number;
  msg: string;
  data: T | null | undefined;
}

// Retained for backward compatibility with server-side callers that inspect
// build-time BFF availability; `buildUrl` always resolves dynamically via
// `resolveBffBaseUrl()` on each request.
export const BASE_URL = resolveBffBaseUrl();

export type RequestOptions = Omit<RequestInit, 'body' | 'headers'> & {
  /** Attach Bearer token from NextAuth session. Default: true */
  auth?: boolean;
  /** Query string params — undefined/null values are omitted */
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Extra headers merged on top of defaults */
  headers?: Record<string, string>;
  /** Treat `path` as a local Next.js API route — skip prefixing BFF base URL. Default: false */
  isLocal?: boolean;
  /** Internal/External option to throw on maintenance mode instead of returning an unsettled promise */
  throwOnMaintenance?: boolean;
};

interface InternalRetryState {
  isRetry?: boolean;
  overrideAccessToken?: string;
}

// Deduplicate concurrent session lookups. `sessionGetter` (next-auth's
// imperative `getSession()`) always issues a fresh, uncached network
// request - unlike the `useSession()` hook, it doesn't share the
// SessionProvider's client-side state.
const sessionLookupMap = new Map<'session', Promise<Session | null>>();
const refreshMap = new Map<'refresh', Promise<Session | null>>();
const refreshTeardownMap = new Map<'teardown', Promise<void>>();

function getSharedSession(): Promise<Session | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  return singleFlight(sessionLookupMap, 'session', () => sessionGetter());
}

function refreshSession(): Promise<Session | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  return singleFlight(refreshMap, 'refresh', () => sessionGetter()).finally(
    () => {
      sessionLookupMap.delete('session');
    }
  );
}

function notifyRefreshTokenError(): void {
  const handler = onRefreshTokenErrorHandler;
  if (!handler || typeof window === 'undefined') return;
  void singleFlight(refreshTeardownMap, 'teardown', async () => {
    await handler();
  }).catch(() => {
    // Best-effort teardown hook; avoid unhandled promise rejections in callers.
  });
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
  const baseUrl = resolveBffBaseUrl();
  const url = isAbsoluteUrl(path) || isLocal ? path : `${baseUrl}${path}`;
  if (!params) return url;

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value));
    }
  });

  const qs = query.toString();
  if (!qs) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${qs}`;
}

async function resolveRequestAuth(overrideAccessToken?: string): Promise<{
  authHeader: Record<string, string>;
  usedToken?: string;
}> {
  if (overrideAccessToken) {
    return {
      authHeader: { Authorization: `Bearer ${overrideAccessToken}` },
      usedToken: overrideAccessToken,
    };
  }
  if (typeof window === 'undefined') {
    return { authHeader: {} };
  }

  const session = await getSharedSession();
  if (session?.error === 'RefreshTokenError') {
    notifyRefreshTokenError();
    return { authHeader: {} };
  }

  const token = session?.accessToken;
  if (!token) {
    return { authHeader: {} };
  }
  return {
    authHeader: { Authorization: `Bearer ${token}` },
    usedToken: token,
  };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
  retryState: InternalRetryState = {}
): Promise<T> {
  const {
    auth = true,
    headers = {},
    params,
    signal,
    isLocal = false,
    ...restOptions
  } = options;
  const { isRetry = false, overrideAccessToken } = retryState;

  // Never attach the user's session token to an absolute external URL —
  // only relative paths (our own backend) are trusted to receive it.
  const effectiveAuth = auth && !isAbsoluteUrl(path);

  if (typeof window === 'undefined' && effectiveAuth) {
    throw new Error(
      'Server-side authenticated requests are not supported. Use auth: false.'
    );
  }

  const { authHeader, usedToken } = effectiveAuth
    ? await resolveRequestAuth(overrideAccessToken)
    : { authHeader: {}, usedToken: undefined };

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
    // Caller-driven cancellation or AbortSignal.timeout — not an error worth reporting.
    if (isAbortError(networkError, signal ?? undefined)) {
      throw networkError;
    }
    // fetch() itself threw — DNS failure, connection refused, etc.
    captureApiFailure({
      endpoint: sanitizeEndpointPath(path),
      method,
      status: 0,
      message:
        networkError instanceof Error ? networkError.message : 'Network error',
      duration: Date.now() - startTime,
    });
    throw networkError;
  }

  if (response.status === 401 && effectiveAuth && !isRetry) {
    const freshSession = await refreshSession();
    if (freshSession?.error === 'RefreshTokenError') {
      notifyRefreshTokenError();
    } else if (
      freshSession?.accessToken &&
      freshSession.accessToken !== usedToken
    ) {
      return request<T>(method, path, body, options, {
        isRetry: true,
        overrideAccessToken: freshSession.accessToken,
      });
    }
  }

  if (!response.ok) {
    if (
      response.status === 503 &&
      response.headers.get('X-Maintenance-Mode') === '1'
    ) {
      if (options?.throwOnMaintenance) {
        throw new MaintenanceError();
      }
      if (typeof window !== 'undefined') {
        if (window.location.pathname !== '/maintenance') {
          window.location.href = '/maintenance';
        }
        return new Promise(() => {}); // Pause further execution during redirect
      }
    }

    const errorBody: unknown = await response.json().catch(() => ({}));
    const errorRecord: Record<string, unknown> = isPlainRecord(errorBody)
      ? errorBody
      : {};
    const topMsg =
      (typeof errorRecord.msg === 'string' && errorRecord.msg.trim()) ||
      (typeof errorRecord.message === 'string' && errorRecord.message.trim()) ||
      undefined;
    const message =
      topMsg ||
      extractNestedDataMessage(errorRecord.data) ||
      extractFastApiDetailMessage(errorRecord.detail) ||
      `Request failed with status ${response.status}`;
    if (response.status >= 500) {
      captureApiFailure({
        endpoint: sanitizeEndpointPath(path),
        method,
        status: response.status,
        message,
        duration: Date.now() - startTime,
      });
    }
    throw new ApiError(
      response.status,
      message,
      normalizeErrorCode(errorRecord.code),
      errorRecord.data,
      errorRecord.detail
    );
  }

  const text = await response.text();
  if (!text) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(response.status, 'Invalid JSON response from server');
  }
}

async function executeRequestUnwrapped<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T | undefined> {
  const startTime = Date.now();
  const result = await request<ApiResponseEnvelope<T>>(
    method,
    path,
    body,
    options
  );
  if (!result) return undefined;

  const rawCode = normalizeErrorCode(result.code);
  if (rawCode !== '0') {
    const numericStatus = rawCode !== undefined ? Number(rawCode) : NaN;
    const validStatus =
      !isNaN(numericStatus) && numericStatus >= 400 && numericStatus < 600
        ? numericStatus
        : 400;
    const message =
      (typeof result.msg === 'string' && result.msg.trim()) ||
      extractNestedDataMessage(result.data) ||
      (rawCode !== undefined
        ? `Request failed with code ${rawCode}`
        : 'Unexpected API response envelope');

    if (validStatus >= 500 && validStatus < 600) {
      captureApiFailure({
        endpoint: sanitizeEndpointPath(path),
        method,
        status: validStatus,
        message,
        duration: Date.now() - startTime,
      });
    }

    throw new ApiError(validStatus, message, rawCode, result.data);
  }

  return result.data ?? undefined;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>('GET', path, undefined, options),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, body, options),

  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, body, options),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, body, options),

  delete: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('DELETE', path, body, options),

  getUnwrapped: <T>(path: string, options?: RequestOptions) =>
    executeRequestUnwrapped<T>('GET', path, undefined, options),

  postUnwrapped: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    executeRequestUnwrapped<T>('POST', path, body, options),

  putUnwrapped: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    executeRequestUnwrapped<T>('PUT', path, body, options),

  patchUnwrapped: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    executeRequestUnwrapped<T>('PATCH', path, body, options),

  deleteUnwrapped: <T>(
    path: string,
    body?: unknown,
    options?: RequestOptions
  ) => executeRequestUnwrapped<T>('DELETE', path, body, options),

  /**
   * Upload binary data to an external presigned URL (e.g. S3).
   * Bypasses BASE_URL, JSON serialization, and Authorization headers intentionally.
   */
  putExternalBinary: async (
    presignedUrl: string,
    body: Blob | ArrayBuffer,
    contentType: string,
    options?: Omit<RequestInit, 'method' | 'body' | 'headers'>
  ): Promise<void> => {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body,
      ...options,
    });
    if (!response.ok) {
      throw new Error(`Upload to presigned URL failed: ${response.status}`);
    }
  },

  /**
   * Fetch an external image or binary resource as a Blob (e.g. for canvas editing).
   * Bypasses BASE_URL and Authorization headers intentionally.
   */
  getExternalBlob: async (
    url: string,
    options?: Omit<RequestInit, 'method' | 'body' | 'headers'>
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
