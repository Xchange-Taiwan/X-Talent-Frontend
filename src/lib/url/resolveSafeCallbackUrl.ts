const INTERNAL_BASE_ORIGIN = 'https://xtalent.local';

export const POST_LOGIN_CALLBACK_URL_KEY = 'post_login_callback_url';

/**
 * Validates and normalizes an internal relative callback URL, rejecting
 * external origins, protocol-relative URLs (`//evil.com` or backslash prefix),
 * auth/API routes (to avoid redirect loops), and malformed strings.
 */
export function extractSafeCallbackUrl(
  rawCallbackUrl: string | null | undefined
): string | null {
  if (typeof rawCallbackUrl !== 'string') {
    return null;
  }

  const trimmed = rawCallbackUrl.trim();
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\')
  ) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, INTERNAL_BASE_ORIGIN);
    if (parsed.origin !== INTERNAL_BASE_ORIGIN) {
      return null;
    }

    const { pathname } = parsed;
    if (
      !pathname.startsWith('/') ||
      pathname.startsWith('//') ||
      pathname.includes('\\') ||
      pathname === '/auth' ||
      pathname.startsWith('/auth/') ||
      pathname === '/api' ||
      pathname.startsWith('/api/') ||
      pathname === '/maintenance'
    ) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function resolveSafeCallbackUrl(
  rawCallbackUrl: string | null | undefined,
  fallback = '/mentor-pool'
): string {
  return extractSafeCallbackUrl(rawCallbackUrl) ?? fallback;
}

export function savePostLoginCallbackUrl(
  rawCallbackUrl: string | null | undefined
): void {
  if (typeof window === 'undefined') return;
  try {
    const safeUrl = extractSafeCallbackUrl(rawCallbackUrl);
    if (safeUrl) {
      window.sessionStorage.setItem(POST_LOGIN_CALLBACK_URL_KEY, safeUrl);
    } else {
      window.sessionStorage.removeItem(POST_LOGIN_CALLBACK_URL_KEY);
    }
  } catch {
    // Ignore storage quota or private-browsing errors
  }
}

export function consumePostLoginCallbackUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(POST_LOGIN_CALLBACK_URL_KEY);
    window.sessionStorage.removeItem(POST_LOGIN_CALLBACK_URL_KEY);
    return extractSafeCallbackUrl(stored);
  } catch {
    return null;
  }
}
