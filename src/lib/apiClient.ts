'use client';

/**
 * Centralized API client with automatic JWT token management.
 *
 * Usage:
 *   import { apiClient } from '@/lib/apiClient';
 *
 *   // Authenticated (default — token injected when NEXT_PUBLIC_USE_API_CLIENT=true)
 *   const data = await apiClient.get<UserDTO>('/v1/mentors/123/en/profile');
 *
 *   // Public endpoint (no token ever)
 *   const data = await apiClient.get<ExpertiseType[]>('/v1/mentors/en/expertises', { auth: false });
 *
 *   // With query params
 *   const mentors = await apiClient.get<MentorType[]>('/v1/mentors', { params: { limit: 10 } });
 *
 * Feature flag:
 *   NEXT_PUBLIC_USE_API_CLIENT=false  → JWT not injected (safe while backend auth isn't ready)
 *   NEXT_PUBLIC_USE_API_CLIENT=true   → JWT auto-injected from NextAuth session
 */

import { getSession } from 'next-auth/react';

import { captureApiFailure } from '@/lib/monitoring';

// ─── Feature flag ────────────────────────────────────────────────────────────
// Flip to true once backend JWT auth is fully configured.
const JWT_ENABLED = process.env.NEXT_PUBLIC_USE_API_CLIENT === 'true';

// ─── Types ───────────────────────────────────────────────────────────────────
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

type RequestOptions = {
  /** Attach Bearer token from NextAuth session. Respects JWT_ENABLED flag. Default: true */
  auth?: boolean;
  /** Extra headers merged on top of defaults */
  headers?: Record<string, string>;
  /** Query string params — undefined/null values are omitted */
  params?: Record<string, string | number | boolean | undefined | null>;
};

// ─── Internals ───────────────────────────────────────────────────────────────
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const url = `${BASE_URL}${path}`;
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
  if (!JWT_ENABLED) return {};
  const session = await getSession();
  const token = session?.accessToken;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const { auth = true, headers = {}, params } = options;

  const authHeader = auth ? await getAuthHeader() : {};

  const startTime = Date.now();
  let response: Response;

  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (networkError) {
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

  if (!response.ok) {
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
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ─── Public API ──────────────────────────────────────────────────────────────
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
};
