import crypto from 'crypto';
import { cookies } from 'next/headers';
import type { User } from 'next-auth';
import { decode } from 'next-auth/jwt';

import {
  type BffEnvSource,
  type BffUserPayload,
  type MentorExperience,
  normalizeBffAuthUser,
  resolveBffBaseUrl,
} from '@/lib/auth/bffAuth';
import type { PreExchangedGoogleOAuthResult } from '@/lib/auth/oauthOutcome';
import {
  consumeOAuthRefreshBridge,
  type CookieStore,
  OAUTH_REFRESH_BRIDGE_TTL_SECONDS,
  setOAuthRefreshBridge,
} from '@/lib/auth/oauthRefreshBridge';
import {
  recordAndCheckBridgeJti,
  sealRefreshBridgeToken,
  unsealRefreshBridgeToken,
} from '@/lib/auth/oauthRefreshBridge.server';
import { isValidUserId } from '@/lib/auth/userGuard';
import { isLiveProductionEnv } from '@/lib/env';
import { singleFlight } from '@/lib/singleFlight';
import { SignInSchema } from '@/schemas/auth';
import type { components } from '@/types/api';

export const E2E_GOOGLE_OAUTH_COOKIE = '__e2e_google_oauth';

export type GoogleCallbackVO = components['schemas']['GoogleCallbackVO'];
export type OAuthCallbackResponse =
  components['schemas']['ApiResponse_GoogleCallbackVO_'];

export const REFRESH_SKEW_SECONDS = 300;
export const BACKEND_LOGOUT_TIMEOUT_MS = 3000;

export type CookieStoreProvider =
  | CookieStore
  | Promise<CookieStore>
  | (() => CookieStore | Promise<CookieStore>);

export interface BffSessionAdapters {
  fetchFn?: typeof fetch;
  cookieStore?: CookieStoreProvider;
  env?: BffEnvSource;
  now?: () => number;
}

export interface BffTokenRefreshResult {
  token: string;
  refreshToken: string | null;
}

function resolveFetch(adapters?: BffSessionAdapters): typeof fetch {
  return adapters?.fetchFn ?? globalThis.fetch;
}

function resolveEnv(adapters?: BffSessionAdapters): BffEnvSource {
  return adapters?.env ?? process.env;
}

function resolveNow(adapters?: Pick<BffSessionAdapters, 'now'>): number {
  return (adapters?.now ?? Date.now)();
}

async function resolveCookieStore(
  adapters?: Pick<BffSessionAdapters, 'cookieStore'>
): Promise<CookieStore> {
  const source = adapters?.cookieStore;
  if (typeof source === 'function') {
    return await source();
  }
  if (source !== undefined) {
    return await source;
  }
  return await cookies();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMentorExperiences(
  raw: unknown
): { ok: true; value: MentorExperience[] | null | undefined } | { ok: false } {
  if (raw === undefined) {
    return { ok: true, value: undefined };
  }
  if (raw === null) {
    return { ok: true, value: null };
  }
  if (!Array.isArray(raw)) {
    return { ok: false };
  }

  const normalized: MentorExperience[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.category !== 'string') {
      return { ok: false };
    }

    const rawMeta = item.mentor_experiences_metadata;
    if (rawMeta !== undefined && rawMeta !== null) {
      if (!isRecord(rawMeta)) {
        return { ok: false };
      }
      if (
        rawMeta.data !== undefined &&
        rawMeta.data !== null &&
        !Array.isArray(rawMeta.data)
      ) {
        return { ok: false };
      }
      normalized.push({
        category: item.category,
        mentor_experiences_metadata: {
          data: Array.isArray(rawMeta.data) ? rawMeta.data : undefined,
        },
      });
    } else {
      normalized.push({ category: item.category });
    }
  }

  return { ok: true, value: normalized };
}

function parseBffUserPayload(
  raw: unknown,
  options: { requireUserId: boolean }
): BffUserPayload | null {
  if (!isRecord(raw)) {
    return null;
  }

  const rawId = raw.user_id;
  const hasValidId =
    (typeof rawId === 'number' && Number.isFinite(rawId)) ||
    (typeof rawId === 'string' && rawId.trim().length > 0);

  if (options.requireUserId && !hasValidId) {
    return null;
  }
  if (
    rawId !== undefined &&
    rawId !== null &&
    typeof rawId !== 'number' &&
    typeof rawId !== 'string'
  ) {
    return null;
  }

  if (
    raw.name !== undefined &&
    raw.name !== null &&
    typeof raw.name !== 'string'
  ) {
    return null;
  }
  if (
    raw.avatar !== undefined &&
    raw.avatar !== null &&
    typeof raw.avatar !== 'string'
  ) {
    return null;
  }
  if (
    raw.avatar_updated_at !== undefined &&
    raw.avatar_updated_at !== null &&
    (typeof raw.avatar_updated_at !== 'number' ||
      !Number.isFinite(raw.avatar_updated_at))
  ) {
    return null;
  }
  if (
    raw.onboarding !== undefined &&
    raw.onboarding !== null &&
    typeof raw.onboarding !== 'boolean'
  ) {
    return null;
  }
  if (
    raw.is_mentor !== undefined &&
    raw.is_mentor !== null &&
    typeof raw.is_mentor !== 'boolean'
  ) {
    return null;
  }
  if (
    raw.job_title !== undefined &&
    raw.job_title !== null &&
    typeof raw.job_title !== 'string'
  ) {
    return null;
  }
  if (
    raw.company !== undefined &&
    raw.company !== null &&
    typeof raw.company !== 'string'
  ) {
    return null;
  }

  const parsedExperiences = parseMentorExperiences(raw.experiences);
  if (!parsedExperiences.ok) {
    return null;
  }

  return {
    user_id: hasValidId ? rawId : null,
    name: typeof raw.name === 'string' ? raw.name : null,
    avatar: typeof raw.avatar === 'string' ? raw.avatar : null,
    avatar_updated_at:
      typeof raw.avatar_updated_at === 'number' ? raw.avatar_updated_at : null,
    onboarding:
      typeof raw.onboarding === 'boolean' ? raw.onboarding : undefined,
    is_mentor: typeof raw.is_mentor === 'boolean' ? raw.is_mentor : undefined,
    job_title: typeof raw.job_title === 'string' ? raw.job_title : null,
    company: typeof raw.company === 'string' ? raw.company : null,
    experiences: parsedExperiences.value,
  };
}

function isGoogleCallbackVO(value: unknown): value is GoogleCallbackVO {
  if (!isRecord(value)) return false;
  if (typeof value.auth_type !== 'string') return false;
  if (!isRecord(value.auth)) return false;
  if (
    value.auth.token !== undefined &&
    value.auth.token !== null &&
    typeof value.auth.token !== 'string'
  ) {
    return false;
  }
  if (
    value.user !== undefined &&
    value.user !== null &&
    !isRecord(value.user)
  ) {
    return false;
  }
  return true;
}

export function extractRefreshTokenCookie(headers: Headers): string | null {
  const setCookieList =
    typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
  for (const cookieHeader of setCookieList) {
    const match = cookieHeader.match(/refresh_token=([^;,]+)/);
    if (match?.[1]) {
      return match[1];
    }
  }

  const fallbackHeader = headers.get('set-cookie') ?? '';
  return fallbackHeader.match(/refresh_token=([^;,]+)/)?.[1] ?? null;
}

export function decodeBffJwtExp(jwtString: string): number | null {
  try {
    const parts = jwtString.split('.');
    if (parts.length < 2 || !parts[1]) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload: unknown = JSON.parse(
      Buffer.from(base64, 'base64').toString('utf-8')
    );
    if (!isRecord(payload)) return null;
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp)
      ? payload.exp
      : null;
  } catch {
    return null;
  }
}

export function isBffTokenExpiringSoon(
  jwtString: string,
  adapters?: Pick<BffSessionAdapters, 'now'>,
  skewSeconds: number = REFRESH_SKEW_SECONDS
): boolean {
  const exp = decodeBffJwtExp(jwtString);
  if (exp === null) return false;
  const nowSeconds = resolveNow(adapters) / 1000;
  return exp - nowSeconds < skewSeconds;
}

export async function loginWithBffCredentials(
  credentials: unknown,
  adapters?: BffSessionAdapters
): Promise<User | null> {
  if (!credentials) return null;

  const validated = SignInSchema.safeParse(credentials);
  if (!validated.success) return null;

  const { email, password } = validated.data;
  const fetchFn = resolveFetch(adapters);
  const baseUrl = resolveBffBaseUrl(resolveEnv(adapters));

  let res: Response;
  try {
    res = await fetchFn(`${baseUrl}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const response: unknown = await res.json().catch(() => null);
  if (!isRecord(response)) return null;
  if (response.code !== undefined && response.code !== '0') return null;
  if (!isRecord(response.data)) return null;

  const { auth, user } = response.data;
  if (!isRecord(auth)) return null;
  if (typeof auth.token !== 'string' || auth.token.length === 0) return null;

  const parsedUser = parseBffUserPayload(user, { requireUserId: false });
  if (!parsedUser) return null;

  const authUserId =
    (typeof auth.user_id === 'number' && Number.isFinite(auth.user_id)) ||
    (typeof auth.user_id === 'string' && auth.user_id.trim().length > 0)
      ? auth.user_id
      : null;

  if (authUserId === null && parsedUser.user_id === null) {
    return null;
  }

  return normalizeBffAuthUser({
    userId: authUserId,
    token: auth.token,
    refreshToken: extractRefreshTokenCookie(res.headers),
    email: typeof auth.email === 'string' ? auth.email : null,
    user: parsedUser,
  });
}

async function clearBridgeCookieSafely(
  adapters?: Pick<BffSessionAdapters, 'cookieStore'>
): Promise<void> {
  try {
    const store = await resolveCookieStore(adapters);
    setOAuthRefreshBridge(store, null);
  } catch {
    // Best-effort cleanup when called outside an active request cookie context.
  }
}

async function requestGoogleOAuthCallbackBff(
  code: string,
  state: string,
  adapters?: Pick<BffSessionAdapters, 'fetchFn' | 'env'>
): Promise<{
  response: OAuthCallbackResponse;
  refreshToken: string | null;
}> {
  const fetchFn = resolveFetch(adapters);
  const baseUrl = resolveBffBaseUrl(resolveEnv(adapters));

  let res: Response;
  try {
    res = await fetchFn(`${baseUrl}/v2/oauth/google/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    });
  } catch {
    return {
      response: {
        code: 'NETWORK_ERROR',
        msg: 'Failed to reach BFF OAuth callback',
        data: null,
      },
      refreshToken: null,
    };
  }

  if (!res.ok) {
    return {
      response: {
        code: String(res.status || 500),
        msg: `Google OAuth callback failed with status ${res.status}`,
        data: null,
      },
      refreshToken: null,
    };
  }

  const raw: unknown = await res.json().catch(() => null);
  if (!isRecord(raw)) {
    return {
      response: {
        code: 'INVALID_RESPONSE',
        msg: 'Invalid BFF Google OAuth callback response',
        data: null,
      },
      refreshToken: null,
    };
  }

  const envelopeCode = raw.code === undefined ? '0' : String(raw.code);
  const envelopeMsg = typeof raw.msg === 'string' ? raw.msg : 'ok';

  if (envelopeCode !== '0') {
    return {
      response: {
        code: envelopeCode,
        msg:
          typeof raw.msg === 'string'
            ? raw.msg
            : 'Google OAuth callback failed',
        data: null,
      },
      refreshToken: null,
    };
  }

  if (raw.data === null || raw.data === undefined) {
    return {
      response: {
        code: '0',
        msg: envelopeMsg,
        data: null,
      },
      refreshToken: null,
    };
  }

  if (!isGoogleCallbackVO(raw.data)) {
    return {
      response: {
        code: 'INVALID_RESPONSE',
        msg: 'Malformed BFF Google OAuth callback payload',
        data: null,
      },
      refreshToken: null,
    };
  }

  const callbackData = raw.data;
  const hasValidLoginToken =
    callbackData.auth_type === 'LOGIN' &&
    typeof callbackData.auth.token === 'string' &&
    callbackData.auth.token.trim().length > 0;

  const refreshToken = hasValidLoginToken
    ? extractRefreshTokenCookie(res.headers)
    : null;

  return {
    response: {
      code: '0',
      msg: envelopeMsg,
      data: callbackData,
    },
    refreshToken,
  };
}

export async function exchangeGoogleOAuthCodeWithBridge(
  code: string,
  state: string,
  adapters?: BffSessionAdapters
): Promise<OAuthCallbackResponse> {
  const { response, refreshToken } = await requestGoogleOAuthCallbackBff(
    code,
    state,
    adapters
  );

  if (!response.data) {
    await clearBridgeCookieSafely(adapters);
    return response;
  }

  const store = await resolveCookieStore(adapters);
  setOAuthRefreshBridge(store, refreshToken);

  return response;
}

async function resolveE2eGoogleOAuthOverride(
  adapters?: Pick<BffSessionAdapters, 'cookieStore' | 'env'>
): Promise<{
  response: OAuthCallbackResponse;
  refreshToken: string | null;
} | null> {
  const env = resolveEnv(adapters);
  if (isLiveProductionEnv(env) || !env.NEXTAUTH_SECRET) {
    return null;
  }

  let rawToken: string | undefined;
  try {
    const store = await resolveCookieStore(adapters);
    rawToken = store.get(E2E_GOOGLE_OAUTH_COOKIE)?.value;
  } catch {
    return null;
  }

  if (!rawToken) {
    return null;
  }

  const decoded = await decode({
    token: rawToken,
    secret: env.NEXTAUTH_SECRET,
  }).catch(() => null);

  if (!decoded || !isRecord(decoded.oauthResponse)) {
    return null;
  }

  return {
    response: decoded.oauthResponse as unknown as OAuthCallbackResponse,
    refreshToken:
      typeof decoded.refreshToken === 'string' &&
      decoded.refreshToken.length > 0
        ? decoded.refreshToken
        : 'e2e_mock_refresh_token',
  };
}

export async function exchangeGoogleOAuthCodeServer(
  code: string,
  state: string,
  adapters?: Pick<BffSessionAdapters, 'fetchFn' | 'cookieStore' | 'env' | 'now'>
): Promise<PreExchangedGoogleOAuthResult> {
  const e2eOverride = await resolveE2eGoogleOAuthOverride(adapters);
  const { response, refreshToken } =
    e2eOverride ?? (await requestGoogleOAuthCallbackBff(code, state, adapters));

  const accessToken =
    response.data?.auth_type === 'LOGIN' ? response.data.auth.token : null;
  const secret = resolveEnv(adapters).NEXTAUTH_SECRET;

  if (!refreshToken || !accessToken || !secret) {
    return {
      response,
      refreshBridgeToken: null,
    };
  }

  try {
    const nowMs = resolveNow(adapters);
    const refreshBridgeToken = sealRefreshBridgeToken(
      {
        jti: crypto.randomUUID(),
        rt: refreshToken,
        accessToken,
        exp: nowMs + OAUTH_REFRESH_BRIDGE_TTL_SECONDS * 1000,
      },
      secret
    );
    return {
      response,
      refreshBridgeToken,
    };
  } catch {
    return {
      response,
      refreshBridgeToken: null,
    };
  }
}

export async function authorizeGoogleBridgePayload(
  credentials: Record<string, unknown> | undefined,
  adapters?: Pick<BffSessionAdapters, 'cookieStore' | 'env' | 'now'>
): Promise<User | null> {
  if (!isRecord(credentials)) return null;
  if (typeof credentials.token !== 'string' || credentials.token.length === 0) {
    return null;
  }
  if (typeof credentials.user !== 'string' || credentials.user.length === 0) {
    return null;
  }
  if (
    credentials.email !== undefined &&
    credentials.email !== null &&
    typeof credentials.email !== 'string'
  ) {
    return null;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(credentials.user);
  } catch {
    return null;
  }

  const validatedUser = parseBffUserPayload(parsedJson, {
    requireUserId: true,
  });
  if (!validatedUser) {
    return null;
  }

  let cookieRefreshToken: string | undefined;
  try {
    const store = await resolveCookieStore(adapters);
    cookieRefreshToken = consumeOAuthRefreshBridge(store);
  } catch {
    cookieRefreshToken = undefined;
  }

  const hasSealedRefreshBridge =
    typeof credentials.refreshBridge === 'string' &&
    credentials.refreshBridge.length > 0;

  let refreshToken: string | undefined = hasSealedRefreshBridge
    ? undefined
    : cookieRefreshToken;

  if (hasSealedRefreshBridge) {
    const secret = resolveEnv(adapters).NEXTAUTH_SECRET;
    if (secret) {
      try {
        const nowMs = resolveNow(adapters);
        const decoded = unsealRefreshBridgeToken(
          credentials.refreshBridge as string,
          secret,
          nowMs
        );
        if (
          decoded &&
          decoded.accessToken === credentials.token &&
          decoded.rt.length > 0 &&
          decoded.jti.length > 0 &&
          recordAndCheckBridgeJti(decoded.jti, nowMs)
        ) {
          refreshToken = decoded.rt;
        }
      } catch {
        refreshToken = undefined;
      }
    }
  }

  return normalizeBffAuthUser({
    token: credentials.token,
    refreshToken,
    email: typeof credentials.email === 'string' ? credentials.email : null,
    user: validatedUser,
  });
}

// BFF rotates the refresh_token on every /v1/auth/token call (revokes the old
// rt:* index immediately). Coalesce concurrent refreshes inside the operation
// itself so no caller can accidentally invoke an un-coalesced rotation.
const inflightTokenRefreshes = new Map<
  string,
  Promise<BffTokenRefreshResult>
>();

export function refreshBffTokenSingleflight(
  currentRefreshToken: string,
  adapters?: Pick<BffSessionAdapters, 'fetchFn' | 'env'>
): Promise<BffTokenRefreshResult> {
  if (!currentRefreshToken) {
    return Promise.reject(new Error('Missing refresh token'));
  }

  return singleFlight(inflightTokenRefreshes, currentRefreshToken, async () => {
    const fetchFn = resolveFetch(adapters);
    const baseUrl = resolveBffBaseUrl(resolveEnv(adapters));

    const res = await fetchFn(`${baseUrl}/v1/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: currentRefreshToken,
      }),
    });

    if (!res.ok) {
      throw new Error(`Token refresh failed with status ${res.status}`);
    }

    const raw: unknown = await res.json().catch(() => null);
    if (!isRecord(raw)) {
      throw new Error('Invalid token refresh response');
    }

    if (raw.code !== undefined && raw.code !== '0') {
      throw new Error(`Token refresh failed with code ${String(raw.code)}`);
    }

    const token =
      isRecord(raw.data) &&
      isRecord(raw.data.auth) &&
      typeof raw.data.auth.token === 'string' &&
      raw.data.auth.token.length > 0
        ? raw.data.auth.token
        : null;

    if (!token) {
      throw new Error('Token refresh response missing token');
    }

    return {
      token,
      refreshToken: extractRefreshTokenCookie(res.headers),
    };
  });
}

export async function revokeBffSession(
  refreshToken: string | null | undefined,
  userId: unknown,
  adapters?: Pick<BffSessionAdapters, 'fetchFn' | 'env'>
): Promise<void> {
  const baseUrl = resolveBffBaseUrl(resolveEnv(adapters));
  if (!baseUrl || !refreshToken || !isValidUserId(userId)) {
    return;
  }

  const fetchFn = resolveFetch(adapters);
  const res = await fetchFn(`${baseUrl}/v1/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `refresh_token=${refreshToken}`,
    },
    body: JSON.stringify({ user_id: Number(userId) }),
    cache: 'no-store',
    signal: AbortSignal.timeout(BACKEND_LOGOUT_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`BFF logout failed with status ${res.status}`);
  }
}
