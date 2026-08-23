const UNKNOWN_ERROR = 'Unknown error';

/**
 * Safely extracts and serializes an error message from an unknown error object,
 * preventing full Axios response objects, headers, or private user configs
 * containing Authorization tokens/PII from leaking into logging/monitoring streams.
 */
export function getSafeErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as Record<string, unknown>).message);
  }
  return UNKNOWN_ERROR;
}

/**
 * Extract error message if available, otherwise return default Chinese fallback.
 * Recommended for standard error handling within components/hooks.
 */
export function getErrorMessage(error: unknown): string {
  const msg = getSafeErrorMessage(error);
  return msg !== UNKNOWN_ERROR ? msg : '發生錯誤，請稍後再試。';
}

/**
 * Checks if an error is an AbortError (either from DOMException or standard Error, or if the AbortSignal was aborted).
 */
export function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) {
    return true;
  }
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}
