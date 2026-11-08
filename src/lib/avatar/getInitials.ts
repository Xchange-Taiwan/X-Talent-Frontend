/**
 * Returns initials from a given full name.
 * Splits by whitespace and gets up to the first two starting characters.
 * If empty or invalid, returns "U".
 *
 * @example
 * getInitials("John Doe") // "JD"
 * getInitials("John") // "J"
 * getInitials("") // "U"
 */
export function getInitials(name?: string | null): string {
  if (!name) return 'U';
  return (
    name
      .trim()
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'
  );
}
