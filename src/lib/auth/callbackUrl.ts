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

/**
 * Validates and normalizes an internal post-login callback URL.
 * Rejects external origins, protocol-relative URLs, auth pages, and API routes
 * to prevent open-redirect vulnerabilities and sign-in redirect loops.
 */
export function sanitizeCallbackUrl(
  raw: string | null | undefined,
  fallback: string = DEFAULT_AUTHENTICATED_PATH
): string {
  if (typeof raw !== 'string') {
    return fallback;
  }

  const trimmed = raw.trim();
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith(`/${BACKSLASH}`) ||
    hasControlCharacters(trimmed)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, 'http://localhost');
    if (
      parsed.origin !== 'http://localhost' ||
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
  } catch {
    return fallback;
  }
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
