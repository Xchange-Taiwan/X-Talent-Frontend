const STORAGE_KEY = 'xtalent.lastGoogleLogin';
const SCHEMA_VERSION = 1;

export interface LastGoogleLoginHint {
  email: string;
  name: string | null;
  avatar: string | null;
  savedAt: number;
}

interface StoredShape extends LastGoogleLoginHint {
  v: number;
}

function isBrowser(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  );
}

export function readLastGoogleLoginHint(): LastGoogleLoginHint | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredShape>;
    if (parsed.v !== SCHEMA_VERSION) return null;
    if (typeof parsed.email !== 'string' || !parsed.email) return null;
    return {
      email: parsed.email,
      name: typeof parsed.name === 'string' ? parsed.name : null,
      avatar: typeof parsed.avatar === 'string' ? parsed.avatar : null,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function writeLastGoogleLoginHint(
  hint: Omit<LastGoogleLoginHint, 'savedAt'>
): void {
  if (!isBrowser()) return;
  if (!hint.email) return;
  try {
    const payload: StoredShape = {
      v: SCHEMA_VERSION,
      email: hint.email,
      name: hint.name ?? null,
      avatar: hint.avatar ?? null,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage unavailable (quota, privacy mode) — silently no-op.
  }
}

export function clearLastGoogleLoginHint(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}

export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 1) return `${local}***${domain}`;
  return `${local[0]}***${domain}`;
}
