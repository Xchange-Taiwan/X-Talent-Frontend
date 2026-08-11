/**
 * Formats elapsed time relative to the current time.
 * - Under 24 hours: formats in hours (e.g., "1 小時", "23 小時")
 * - 24 hours or more: formats in days (e.g., "1 天", "30 天")
 */
export function formatRelativeTime(dateInput: Date | string): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) {
    return '';
  }
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 24) {
    const hours = Math.max(1, diffHours);
    return `${hours} 小時`;
  } else {
    const days = Math.floor(diffHours / 24);
    return `${days} 天`;
  }
}
