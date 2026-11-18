import crypto from 'crypto';

import {
  type CookieStore,
  OAUTH_REFRESH_BRIDGE_TTL_SECONDS,
} from '@/lib/auth/oauthRefreshBridge';

export const OAUTH_CONSUMED_JTI_COOKIE = 'g_oauth_jti';

export interface SealedRefreshBridgePayload {
  jti: string;
  rt: string;
  accessToken: string;
  exp: number;
}

/**
 * Defense-in-depth replay protection for the 60-second encrypted OAuth refresh
 * bridge in a stateless Next.js frontend (which has no shared Redis/database):
 * 1. Cryptographic token binding (`decoded.accessToken === credentials.token`)
 *    ensures a sealed bridge token is useless without the matching short-lived
 *    BFF access token, and BFF `/v1/auth/token` enforces authoritative
 *    server-side single-use refresh token rotation (`rt:*` revocation).
 * 2. Cross-instance browser replay is blocked via an HMAC-authenticated
 *    `HttpOnly` tombstone cookie (`g_oauth_jti`, 60s `maxAge`) verified across
 *    all Serverless instances.
 * 3. Same-isolate raw HTTP replay without cookies is blocked via `consumedRefreshBridgeJtis`.
 */
const consumedRefreshBridgeJtis = new Map<string, number>();

function signConsumedJtiTag(jti: string, secret: string): string {
  return crypto
    .createHmac('sha256', deriveRefreshBridgeKey(secret))
    .update(`consumed:${jti}`)
    .digest('base64url');
}

export function isBridgeJtiConsumedInCookie(
  cookieStore: CookieStore | null | undefined,
  jti: string,
  secret: string
): boolean {
  const raw = cookieStore?.get(OAUTH_CONSUMED_JTI_COOKIE)?.value;
  if (!raw) return false;
  const expected = `${jti}.${signConsumedJtiTag(jti, secret)}`;
  const a = Buffer.from(raw, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(
    new Uint8Array(a.buffer, a.byteOffset, a.byteLength),
    new Uint8Array(b.buffer, b.byteOffset, b.byteLength)
  );
}

export function writeConsumedBridgeJtiCookie(
  cookieStore: CookieStore | null | undefined,
  jti: string,
  secret: string
): void {
  if (!cookieStore) return;
  try {
    cookieStore.set(
      OAUTH_CONSUMED_JTI_COOKIE,
      `${jti}.${signConsumedJtiTag(jti, secret)}`,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: OAUTH_REFRESH_BRIDGE_TTL_SECONDS,
      }
    );
  } catch {
    // Read-only cookie context fallback; per-isolate Map + BFF rotation still apply.
  }
}

export function recordAndCheckBridgeJti(
  jti: string,
  nowMs: number,
  options?: { cookieStore?: CookieStore | null; secret?: string }
): boolean {
  if (
    options?.secret &&
    isBridgeJtiConsumedInCookie(options.cookieStore, jti, options.secret)
  ) {
    return false;
  }

  consumedRefreshBridgeJtis.forEach((expiresAt, key) => {
    if (expiresAt <= nowMs) {
      consumedRefreshBridgeJtis.delete(key);
    }
  });
  if (consumedRefreshBridgeJtis.has(jti)) {
    return false;
  }
  consumedRefreshBridgeJtis.set(
    jti,
    nowMs + OAUTH_REFRESH_BRIDGE_TTL_SECONDS * 1000
  );

  if (options?.secret) {
    writeConsumedBridgeJtiCookie(options.cookieStore, jti, options.secret);
  }
  return true;
}

export function deriveRefreshBridgeKey(secret: string): crypto.KeyObject {
  const rawKey = crypto.hkdfSync(
    'sha256',
    secret,
    '',
    'xtalent-oauth-refresh-bridge-v1',
    32
  );
  return crypto.createSecretKey(new Uint8Array(rawKey));
}

export function sealRefreshBridgeToken(
  payload: SealedRefreshBridgePayload,
  secret: string
): string {
  const key = deriveRefreshBridgeKey(secret);
  const ivBytes = crypto.randomBytes(12);
  const iv = new Uint8Array(
    ivBytes.buffer,
    ivBytes.byteOffset,
    ivBytes.byteLength
  );
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertextB64 =
    cipher.update(JSON.stringify(payload), 'utf8', 'base64url') +
    cipher.final('base64url');
  const tagB64 = cipher.getAuthTag().toString('base64url');
  return `${ivBytes.toString('base64url')}.${tagB64}.${ciphertextB64}`;
}

export function unsealRefreshBridgeToken(
  sealed: string,
  secret: string,
  nowMs: number
): SealedRefreshBridgePayload | null {
  const parts = sealed.split('.');
  if (parts.length !== 3 || !parts[2]) return null;
  const ivBuf = Buffer.from(parts[0], 'base64url');
  const tagBuf = Buffer.from(parts[1], 'base64url');
  if (ivBuf.length !== 12 || tagBuf.length !== 16) {
    return null;
  }

  const key = deriveRefreshBridgeKey(secret);
  const iv = new Uint8Array(ivBuf.buffer, ivBuf.byteOffset, ivBuf.byteLength);
  const tag = new Uint8Array(
    tagBuf.buffer,
    tagBuf.byteOffset,
    tagBuf.byteLength
  );
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext =
    decipher.update(parts[2], 'base64url', 'utf8') + decipher.final('utf8');

  const parsed: unknown = JSON.parse(plaintext);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  if (
    typeof record.jti !== 'string' ||
    typeof record.rt !== 'string' ||
    typeof record.accessToken !== 'string' ||
    typeof record.exp !== 'number' ||
    record.exp <= nowMs
  ) {
    return null;
  }
  return {
    jti: record.jti,
    rt: record.rt,
    accessToken: record.accessToken,
    exp: record.exp,
  };
}
