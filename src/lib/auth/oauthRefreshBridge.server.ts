import crypto from 'crypto';

import { OAUTH_REFRESH_BRIDGE_TTL_SECONDS } from '@/lib/auth/oauthRefreshBridge';

export interface SealedRefreshBridgePayload {
  jti: string;
  rt: string;
  accessToken: string;
  exp: number;
}

const consumedRefreshBridgeJtis = new Map<string, number>();

export function recordAndCheckBridgeJti(jti: string, nowMs: number): boolean {
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
