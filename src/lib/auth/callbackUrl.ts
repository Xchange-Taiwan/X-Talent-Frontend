import {
  isDisallowedCallbackPathname,
  sanitizeCallbackUrl,
} from '@/lib/routes';

export { isDisallowedCallbackPathname, sanitizeCallbackUrl };

export const PENDING_AUTH_CALLBACK_URL_KEY = 'pending_auth_callback_url';

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
