import { sanitizeCallbackUrl } from '@/lib/routes';

export const PENDING_VERIFICATION_EMAIL_KEY = 'email';
export const PENDING_PASSWORD_RESET_EMAIL_KEY = 'pending_reset_email';
export const PENDING_DELETE_ACCOUNT_EMAIL_KEY = 'delete_account_email';
export const PENDING_AUTH_CALLBACK_URL_KEY = 'pending_auth_callback_url';

export const AUTH_FLOW_STORAGE_KEYS = [
  PENDING_VERIFICATION_EMAIL_KEY,
  PENDING_PASSWORD_RESET_EMAIL_KEY,
  PENDING_DELETE_ACCOUNT_EMAIL_KEY,
  PENDING_AUTH_CALLBACK_URL_KEY,
] as const;

export type AuthFlowStorageKey = (typeof AUTH_FLOW_STORAGE_KEYS)[number];

export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface InMemorySessionStorage extends SessionStorageLike {
  dump(): Record<string, string>;
}

export function createInMemorySessionStorage(
  initial: Record<string, string> = {}
): InMemorySessionStorage {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    dump(): Record<string, string> {
      return Object.fromEntries(store.entries());
    },
  };
}

function resolveSessionStorage(
  override?: SessionStorageLike | null
): SessionStorageLike | null {
  if (override !== undefined) {
    return override;
  }
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

function readKey(
  key: AuthFlowStorageKey,
  storage?: SessionStorageLike | null
): string | null {
  const target = resolveSessionStorage(storage);
  if (!target) return null;
  try {
    return target.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(
  key: AuthFlowStorageKey,
  value: string,
  storage?: SessionStorageLike | null
): void {
  const target = resolveSessionStorage(storage);
  if (!target) return;
  try {
    target.setItem(key, value);
  } catch {
    // Ignore storage quota or private-browsing failures.
  }
}

function deleteKey(
  key: AuthFlowStorageKey,
  storage?: SessionStorageLike | null
): void {
  const target = resolveSessionStorage(storage);
  if (!target) return;
  try {
    target.removeItem(key);
  } catch {
    // Ignore storage access failures.
  }
}

export function getPendingVerificationEmail(
  storage?: SessionStorageLike | null
): string | null {
  return readKey(PENDING_VERIFICATION_EMAIL_KEY, storage);
}

export function setPendingVerificationEmail(
  email: string,
  storage?: SessionStorageLike | null
): void {
  writeKey(PENDING_VERIFICATION_EMAIL_KEY, email, storage);
}

export function clearPendingVerificationEmail(
  storage?: SessionStorageLike | null
): void {
  deleteKey(PENDING_VERIFICATION_EMAIL_KEY, storage);
}

export function getPendingPasswordResetEmail(
  storage?: SessionStorageLike | null
): string | null {
  return readKey(PENDING_PASSWORD_RESET_EMAIL_KEY, storage);
}

export function setPendingPasswordResetEmail(
  email: string,
  storage?: SessionStorageLike | null
): void {
  writeKey(PENDING_PASSWORD_RESET_EMAIL_KEY, email, storage);
}

export function clearPendingPasswordResetEmail(
  storage?: SessionStorageLike | null
): void {
  deleteKey(PENDING_PASSWORD_RESET_EMAIL_KEY, storage);
}

export function getPendingDeleteAccountEmail(
  storage?: SessionStorageLike | null
): string | null {
  return readKey(PENDING_DELETE_ACCOUNT_EMAIL_KEY, storage);
}

export function setPendingDeleteAccountEmail(
  email: string,
  storage?: SessionStorageLike | null
): void {
  writeKey(PENDING_DELETE_ACCOUNT_EMAIL_KEY, email, storage);
}

export function clearPendingDeleteAccountEmail(
  storage?: SessionStorageLike | null
): void {
  deleteKey(PENDING_DELETE_ACCOUNT_EMAIL_KEY, storage);
}

export function persistPendingCallbackUrlFromSearch(
  search: string,
  currentOrigin?: string,
  storage?: SessionStorageLike | null
): void {
  const raw = new URLSearchParams(search).get('callbackUrl');
  const safeUrl = sanitizeCallbackUrl(raw, currentOrigin);
  if (safeUrl) {
    writeKey(PENDING_AUTH_CALLBACK_URL_KEY, safeUrl, storage);
  } else {
    deleteKey(PENDING_AUTH_CALLBACK_URL_KEY, storage);
  }
}

export function clearPendingCallbackUrl(
  storage?: SessionStorageLike | null
): void {
  deleteKey(PENDING_AUTH_CALLBACK_URL_KEY, storage);
}

export function consumePendingCallbackUrl(
  currentOrigin?: string,
  storage?: SessionStorageLike | null
): string | null {
  const stored = readKey(PENDING_AUTH_CALLBACK_URL_KEY, storage);
  deleteKey(PENDING_AUTH_CALLBACK_URL_KEY, storage);
  return sanitizeCallbackUrl(stored, currentOrigin);
}

export function clearAuthFlowStorage(
  storage?: SessionStorageLike | null
): void {
  for (const key of AUTH_FLOW_STORAGE_KEYS) {
    deleteKey(key, storage);
  }
}

export interface AuthFlowStore {
  getVerificationEmail(override?: SessionStorageLike | null): string | null;
  setVerificationEmail(
    email: string,
    override?: SessionStorageLike | null
  ): void;
  clearVerificationEmail(override?: SessionStorageLike | null): void;
  getPasswordResetEmail(override?: SessionStorageLike | null): string | null;
  setPasswordResetEmail(
    email: string,
    override?: SessionStorageLike | null
  ): void;
  clearPasswordResetEmail(override?: SessionStorageLike | null): void;
  getDeleteAccountEmail(override?: SessionStorageLike | null): string | null;
  setDeleteAccountEmail(
    email: string,
    override?: SessionStorageLike | null
  ): void;
  clearDeleteAccountEmail(override?: SessionStorageLike | null): void;
  persistCallbackUrlFromSearch(
    search: string,
    currentOrigin?: string,
    override?: SessionStorageLike | null
  ): void;
  clearCallbackUrl(override?: SessionStorageLike | null): void;
  consumeCallbackUrl(
    currentOrigin?: string,
    override?: SessionStorageLike | null
  ): string | null;
  clearAll(override?: SessionStorageLike | null): void;
}

export function createAuthFlowStore(
  defaultStorage?: SessionStorageLike | null
): AuthFlowStore {
  const pick = (
    override?: SessionStorageLike | null
  ): SessionStorageLike | null | undefined =>
    override !== undefined ? override : defaultStorage;

  return {
    getVerificationEmail: (override) =>
      getPendingVerificationEmail(pick(override)),
    setVerificationEmail: (email, override) =>
      setPendingVerificationEmail(email, pick(override)),
    clearVerificationEmail: (override) =>
      clearPendingVerificationEmail(pick(override)),
    getPasswordResetEmail: (override) =>
      getPendingPasswordResetEmail(pick(override)),
    setPasswordResetEmail: (email, override) =>
      setPendingPasswordResetEmail(email, pick(override)),
    clearPasswordResetEmail: (override) =>
      clearPendingPasswordResetEmail(pick(override)),
    getDeleteAccountEmail: (override) =>
      getPendingDeleteAccountEmail(pick(override)),
    setDeleteAccountEmail: (email, override) =>
      setPendingDeleteAccountEmail(email, pick(override)),
    clearDeleteAccountEmail: (override) =>
      clearPendingDeleteAccountEmail(pick(override)),
    persistCallbackUrlFromSearch: (search, currentOrigin, override) =>
      persistPendingCallbackUrlFromSearch(
        search,
        currentOrigin,
        pick(override)
      ),
    clearCallbackUrl: (override) => clearPendingCallbackUrl(pick(override)),
    consumeCallbackUrl: (currentOrigin, override) =>
      consumePendingCallbackUrl(currentOrigin, pick(override)),
    clearAll: (override) => clearAuthFlowStorage(pick(override)),
  };
}
