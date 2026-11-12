const PENDING_CALLBACK_URL_KEY = 'post_login_callback_url';
const DEFAULT_POST_LOGIN_PATH = '/mentor-pool';
const BACKSLASH_CHAR = String.fromCharCode(92);

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
}

/**
 * Validates and normalizes an internal post-login redirect target.
 * Rejects protocol-relative URLs (`//evil.com`), backslash tricks,
 * external schemes, control characters, `/auth/*` loops, and `/api/*` endpoints.
 */
export function sanitizeCallbackUrl(
  rawUrl: string | null | undefined
): string | null {
  if (typeof rawUrl !== 'string') {
    return null;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null;
  }

  if (trimmed.includes(BACKSLASH_CHAR) || hasControlChar(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, 'https://x-talent.local');
    if (parsed.origin !== 'https://x-talent.local') {
      return null;
    }

    if (!parsed.pathname.startsWith('/') || parsed.pathname.startsWith('//')) {
      return null;
    }

    if (
      parsed.pathname === '/auth' ||
      parsed.pathname.startsWith('/auth/') ||
      parsed.pathname === '/api' ||
      parsed.pathname.startsWith('/api/')
    ) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function readWindowCallbackUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  return sanitizeCallbackUrl(params.get('callbackUrl'));
}

export function savePendingCallbackUrl(
  rawUrl: string | null | undefined
): void {
  if (typeof window === 'undefined') {
    return;
  }
  const safe = sanitizeCallbackUrl(rawUrl);
  try {
    if (safe) {
      sessionStorage.setItem(PENDING_CALLBACK_URL_KEY, safe);
    } else {
      sessionStorage.removeItem(PENDING_CALLBACK_URL_KEY);
    }
  } catch {
    // Ignore storage quota or private-browsing SecurityError
  }
}

export function clearPendingCallbackUrl(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.removeItem(PENDING_CALLBACK_URL_KEY);
  } catch {
    // Ignore storage SecurityError
  }
}

export function consumePendingCallbackUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const stored = sessionStorage.getItem(PENDING_CALLBACK_URL_KEY);
    sessionStorage.removeItem(PENDING_CALLBACK_URL_KEY);
    return sanitizeCallbackUrl(stored);
  } catch {
    return null;
  }
}

export function resolvePostLoginRedirect(opts: {
  onBoarding?: boolean | null;
  callbackUrl?: string | null;
}): string {
  if (opts.onBoarding === false) {
    return '/auth/onboarding';
  }
  return sanitizeCallbackUrl(opts.callbackUrl) ?? DEFAULT_POST_LOGIN_PATH;
}
