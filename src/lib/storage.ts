/**
 * Safe helper to read from localStorage. Returns null if not in browser or on error (e.g. privacy settings/private mode).
 */
export function safeGetStorage(key: string): string | null {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error('[storage] Failed to read from localStorage:', e);
    }
  }
  return null;
}

/**
 * Safe helper to write to localStorage. No-op if not in browser or on error (e.g. privacy settings/private mode).
 */
export function safeSetStorage(key: string, value: string): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error('[storage] Failed to write to localStorage:', e);
    }
  }
}
