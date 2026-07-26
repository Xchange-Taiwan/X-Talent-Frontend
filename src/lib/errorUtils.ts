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
  return 'Unknown error';
}
