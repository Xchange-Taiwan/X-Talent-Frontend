/**
 * Resolves the public site origin for absolute URLs (sitemap, robots, OG).
 *
 * Why: production prematurely fell back to `http://localhost:3000` when
 * `NEXT_PUBLIC_SITE_URL` wasn't set on Vercel, leaking into robots.txt
 * `Sitemap:` line and `metadataBase`. Vercel auto-provides
 * `VERCEL_PROJECT_PRODUCTION_URL` (host only, no scheme) in every build,
 * so use it as a fallback before localhost.
 */
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return 'http://localhost:3000';
}
