/**
 * Returns the thumbnail variant of an S3 avatar URL.
 *
 * Pattern: trailing "/avatar" is replaced with "/avatar-thumb".
 * Query parameters (e.g. cache-busting `?cb=...`) are preserved.
 *
 * Use avatar-thumb for small display areas (header, dropdown, reservation cards,
 * share-profile dialog). Use the original URL for full-size contexts (profile
 * page, profile edit page, onboarding, profile card).
 *
 * @example
 * // "https://…/files/123/avatar-thumb"
 * getAvatarThumbUrl("https://…/files/123/avatar")
 *
 * // "https://…/files/123/avatar-thumb?cb=1234567890"
 * getAvatarThumbUrl("https://…/files/123/avatar?cb=1234567890")
 */
export function getAvatarThumbUrl(avatarUrl: string): string {
  if (!avatarUrl) return avatarUrl;
  const qIdx = avatarUrl.indexOf('?');
  const base = qIdx === -1 ? avatarUrl : avatarUrl.slice(0, qIdx);
  const query = qIdx === -1 ? '' : avatarUrl.slice(qIdx);
  const thumbBase = base.replace(/\/avatar$/, '/avatar-thumb');
  return thumbBase + query;
}
