/**
 * Allow-list URL scheme guard for any value that flows into an `<a href>`.
 * Blocks `javascript:`, `data:`, `vbscript:`, etc., which would otherwise
 * execute in the current origin when clicked. Only `https:` is accepted —
 * matches the SEO sanitizer's policy so UI render and JSON-LD stay aligned.
 */
export function isSafeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
