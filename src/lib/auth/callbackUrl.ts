const PENDING_SIGNIN_CALLBACK_URL_KEY = 'pending_signin_callback_url';
const DEFAULT_AUTHENTICATED_PATH = '/mentor-pool';
const BACKSLASH = String.fromCharCode(92);

function hasControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

function resolveTrustedOrigin(explicitOrigin?: string): string | null {
  const trimmedOrigin = explicitOrigin?.trim();
  if (trimmedOrigin) {
    try {
      const originUrl = new URL(trimmedOrigin);
      if (originUrl.protocol === 'http:' || originUrl.protocol === 'https:') {
        return originUrl.origin;
      }
    } catch {
      return null;
    }
    return null;
  }

  if (
    typeof window !== 'undefined' &&
    typeof window.location?.origin === 'string' &&
    window.location.origin !== 'null'
  ) {
    return window.location.origin;
  }

  return null;
}

/**
 * Validates and normalizes an internal post-login callback URL.
 * Supports both relative paths and same-origin absolute URLs (preserving full
 * query params and hash), while rejecting external origins, protocol-relative
 * URLs, dot-segment protocol-relative bypasses, auth pages, and API routes.
 */
export function sanitizeCallbackUrl(
  raw: string | null | undefined,
  fallback: string = DEFAULT_AUTHENTICATED_PATH,
  currentOrigin?: string
): string {
  if (typeof raw !== 'string') {
    return fallback;
  }

  const trimmed = raw.trim();
  if (
    !trimmed ||
    trimmed.includes(BACKSLASH) ||
    hasControlCharacters(trimmed)
  ) {
    return fallback;
  }

  const trustedOrigin = resolveTrustedOrigin(currentOrigin);
  let parsed: URL;

  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//')) {
      return fallback;
    }
    const baseOrigin = trustedOrigin ?? 'http://localhost';
    try {
      parsed = new URL(trimmed, baseOrigin);
    } catch {
      return fallback;
    }
    if (parsed.origin !== baseOrigin) {
      return fallback;
    }
  } else if (/^https?:\/\//i.test(trimmed)) {
    if (!trustedOrigin) {
      return fallback;
    }
    try {
      parsed = new URL(trimmed);
    } catch {
      return fallback;
    }
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.origin !== trustedOrigin ||
      parsed.username !== '' ||
      parsed.password !== ''
    ) {
      return fallback;
    }
  } else {
    return fallback;
  }

  if (
    parsed.pathname === '/' ||
    parsed.pathname.startsWith('//') ||
    parsed.pathname.includes(BACKSLASH) ||
    parsed.pathname.startsWith('/auth/') ||
    parsed.pathname === '/auth' ||
    parsed.pathname.startsWith('/api/') ||
    parsed.pathname === '/api'
  ) {
    return fallback;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function setPendingSignInCallbackUrl(
  raw: string | null | undefined
): void {
  if (typeof window === 'undefined') return;
  const sanitized = sanitizeCallbackUrl(raw, '');
  try {
    if (sanitized) {
      sessionStorage.setItem(PENDING_SIGNIN_CALLBACK_URL_KEY, sanitized);
    } else {
      sessionStorage.removeItem(PENDING_SIGNIN_CALLBACK_URL_KEY);
    }
  } catch {
    // Ignore storage access errors in restricted browsing contexts
  }
}

export function clearPendingSignInCallbackUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PENDING_SIGNIN_CALLBACK_URL_KEY);
  } catch {
    // Ignore storage access errors in restricted browsing contexts
  }
}

export function consumePendingSignInCallbackUrl(
  fallback: string = DEFAULT_AUTHENTICATED_PATH
): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = sessionStorage.getItem(PENDING_SIGNIN_CALLBACK_URL_KEY);
    sessionStorage.removeItem(PENDING_SIGNIN_CALLBACK_URL_KEY);
    return sanitizeCallbackUrl(stored, fallback);
  } catch {
    return fallback;
  }
}
