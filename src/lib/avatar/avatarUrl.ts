export type AvatarVersionParam = 'v' | 'cb';

interface ParsedAvatarUrl {
  base: string;
  rawQuery: string;
  hash: string;
  params: URLSearchParams;
}

function parseAvatarUrl(avatarUrl: string): ParsedAvatarUrl {
  const hashIdx = avatarUrl.indexOf('#');
  const withoutHash = hashIdx === -1 ? avatarUrl : avatarUrl.slice(0, hashIdx);
  const hash = hashIdx === -1 ? '' : avatarUrl.slice(hashIdx);

  const qIdx = withoutHash.indexOf('?');
  const base = qIdx === -1 ? withoutHash : withoutHash.slice(0, qIdx);
  const rawQuery = qIdx === -1 ? '' : withoutHash.slice(qIdx + 1);

  // Heal any malformed legacy double-`?` query strings (`?v=1?cb=2` -> `v=1&cb=2`)
  const normalizedQuery = rawQuery.replace(/\?/g, '&');

  return {
    base,
    rawQuery,
    hash,
    params: new URLSearchParams(normalizedQuery),
  };
}

function canonicalizeAvatarParams(params: URLSearchParams): string {
  const canonical = new URLSearchParams();
  const entries = Array.from(params.entries())
    .filter(([key]) => key !== 'cb')
    .sort(([keyA, valA], [keyB, valB]) =>
      keyA === keyB ? valA.localeCompare(valB) : keyA.localeCompare(keyB)
    );

  for (const [key, value] of entries) {
    canonical.append(key, value);
  }

  return canonical.toString();
}

/**
 * Stamps or updates a version/cache-busting query parameter (`v` or `cb`) on
 * an avatar URL without producing malformed double-`?` URLs when a query
 * string is already present.
 */
export function withAvatarVersion(
  avatarUrl: string,
  version: string | number | null | undefined,
  param: AvatarVersionParam = 'v'
): string {
  if (!avatarUrl) return avatarUrl;
  if (version === null || version === undefined) return avatarUrl;
  const serializedVersion = String(version);
  if (!serializedVersion) return avatarUrl;

  const { base, hash, params } = parseAvatarUrl(avatarUrl);
  params.set(param, serializedVersion);
  const query = params.toString();

  return `${base}${query ? `?${query}` : ''}${hash}`;
}

/**
 * Derives the `/avatar-thumb` S3 variant from an avatar URL while preserving
 * query parameters (`?v=...`, `&cb=...`) and hash fragments.
 */
export function toAvatarThumbUrl(avatarUrl: string): string {
  if (!avatarUrl) return avatarUrl;
  const { base, rawQuery, hash } = parseAvatarUrl(avatarUrl);
  const thumbBase = base.replace(/\/avatar$/, '/avatar-thumb');
  const queryPrefix = rawQuery ? `?${rawQuery.replace(/\?/g, '&')}` : '';
  return `${thumbBase}${queryPrefix}${hash}`;
}

/**
 * Determines whether an incoming/actual avatar value has converged with an
 * expected avatar URL across write-time `?v=` versions and read-time `&cb=`
 * cache-busters.
 *
 * - `expected === undefined`: caller placed no constraint on avatar -> `true`
 * - `expected === null` or `''`: expects empty/absent avatar -> `true` iff `actual` is empty/nullish
 * - non-empty `expected`: compares base asset URL and all canonical non-`cb`
 *   query parameters (including `v`) symmetrically, avoiding `startsWith`
 *   prefix false-positives (`?v=17` vs `?v=1799`, `/avatar` vs `/avatar-old`).
 */
export function hasAvatarVersionConverged(
  expected: string | null | undefined,
  actual: unknown
): boolean {
  if (expected === undefined) return true;
  if (!expected) {
    return actual === null || actual === undefined || actual === '';
  }
  if (typeof actual !== 'string' || !actual) {
    return false;
  }

  const expectedParsed = parseAvatarUrl(expected);
  const actualParsed = parseAvatarUrl(actual);

  if (expectedParsed.base !== actualParsed.base) {
    return false;
  }

  return (
    canonicalizeAvatarParams(expectedParsed.params) ===
    canonicalizeAvatarParams(actualParsed.params)
  );
}
