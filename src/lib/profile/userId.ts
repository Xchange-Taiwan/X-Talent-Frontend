const POSITIVE_INTEGER_ID_PATTERN = /^[1-9]\d*$/;

/**
 * Normalizes a positive integer user ID from either a safe JS number or a
 * base-10 numeric string (including 64-bit Snowflake IDs exceeding
 * `Number.MAX_SAFE_INTEGER`) into its canonical exact string form.
 *
 * Returns `null` for `0`, negative numbers, floats, unsafe JS numbers, empty
 * strings, or non-digit strings.
 */
export function normalizePositiveUserId(
  userId: number | string | null | undefined
): string | null {
  if (typeof userId === 'number') {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return null;
    }
    return String(userId);
  }
  if (typeof userId === 'string') {
    const trimmed = userId.trim();
    return POSITIVE_INTEGER_ID_PATTERN.test(trimmed) ? trimmed : null;
  }
  return null;
}
