export const PENDING_AUTH_CALLBACK_URL_KEY = 'pending_auth_callback_url';

const INTERNAL_BASE_ORIGIN = 'https://x-talent-internal.local';
const SLASH_BACKSLASH_PREFIX = `/${String.fromCharCode(92)}`;

function isDisallowedCallbackPathname(pathname: string): boolean {
  return (
    !pathname.startsWith('/') ||
    pathname.startsWith('//') ||
    pathname.startsWith(SLASH_BACKSLASH_PREFIX) ||
    pathname === '/auth' ||
    pathname.startsWith('/auth/') ||
    pathname === '/api' ||
    pathname.startsWith('/api/')
  );
}

/**
 * Validates and normalizes a post-login `callbackUrl` so only safe, same-origin
 * internal paths (preserving full query string and hash) are accepted.
 * Rejects protocol-relative URLs (`//evil.com`), backslash tricks,
 * external origins, `javascript:`/`data:` schemes, and `/auth/*` or `/api/*` loops.
 */
export function sanitizeCallbackUrl(
  rawCallbackUrl: string | null | undefined,
  currentOrigin?: string
): string | null {
  if (!rawCallbackUrl) return null;

  const trimmed = rawCallbackUrl.trim();
  if (!trimmed) return null;

  // Relative internal path: must start with a single `/` and not `//` or `/`
  if (trimmed.startsWith('/')) {
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith(SLASH_BACKSLASH_PREFIX)
    ) {
      return null;
    }

    try {
      const parsed = new URL(trimmed, INTERNAL_BASE_ORIGIN);
      if (parsed.origin !== INTERNAL_BASE_ORIGIN) {
        return null;
      }
      if (isDisallowedCallbackPathname(parsed.pathname)) {
        return null;
      }
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return null;
    }
  }

  // Same-origin absolute URL (only when `currentOrigin` is explicitly known)
  if (currentOrigin) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.origin !== currentOrigin) {
        return null;
      }
      if (isDisallowedCallbackPathname(parsed.pathname)) {
        return null;
      }
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Extracts and stores a sanitized `callbackUrl` from a URL query string into
 * `sessionStorage` before redirecting to an external OAuth provider.
 */
export function persistPendingCallbackUrlFromSearch(
  search: string,
  currentOrigin?: string
): void {
  if (typeof window === 'undefined') return;

  try {
    const params = new URLSearchParams(search);
    const safeUrl = sanitizeCallbackUrl(
      params.get('callbackUrl'),
      currentOrigin
    );
    if (safeUrl) {
      sessionStorage.setItem(PENDING_AUTH_CALLBACK_URL_KEY, safeUrl);
    } else {
      sessionStorage.removeItem(PENDING_AUTH_CALLBACK_URL_KEY);
    }
  } catch {
    // Ignore storage access errors in restricted browsing contexts
  }
}

export function clearPendingCallbackUrl(): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem(PENDING_AUTH_CALLBACK_URL_KEY);
  } catch {
    // Ignore storage access errors
  }
}

export function consumePendingCallbackUrl(
  currentOrigin?: string
): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = sessionStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY);
    sessionStorage.removeItem(PENDING_AUTH_CALLBACK_URL_KEY);
    return sanitizeCallbackUrl(stored, currentOrigin);
  } catch {
    return null;
  }
}
