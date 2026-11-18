export type AvatarVersionParam = 'v' | 'cb';

export const PRESET_AVATAR_CODES = [
  'default_1',
  'default_2',
  'default_3',
  'default_4',
  'default_5',
  'default_6',
] as const;

export type PresetAvatarCode = (typeof PRESET_AVATAR_CODES)[number];

export const DEFAULT_PRESET_AVATAR_CODE: PresetAvatarCode = 'default_1';

export const PRESET_AVATAR_URLS = [
  '/avatars/default_1.webp',
  '/avatars/default_2.webp',
  '/avatars/default_3.webp',
  '/avatars/default_4.webp',
  '/avatars/default_5.webp',
  '/avatars/default_6.webp',
] as const;

export type PresetAvatarUrl = (typeof PRESET_AVATAR_URLS)[number];

const PRESET_AVATAR_URL_SET = new Set<string>(PRESET_AVATAR_URLS);
const PRESET_AVATAR_CODE_SET = new Set<string>(PRESET_AVATAR_CODES);

const CODE_TO_URL: Readonly<Record<PresetAvatarCode, PresetAvatarUrl>> = {
  default_1: '/avatars/default_1.webp',
  default_2: '/avatars/default_2.webp',
  default_3: '/avatars/default_3.webp',
  default_4: '/avatars/default_4.webp',
  default_5: '/avatars/default_5.webp',
  default_6: '/avatars/default_6.webp',
};

const URL_TO_CODE: Readonly<Record<string, PresetAvatarCode>> = {
  '/avatars/default_1.webp': 'default_1',
  '/avatars/default_2.webp': 'default_2',
  '/avatars/default_3.webp': 'default_3',
  '/avatars/default_4.webp': 'default_4',
  '/avatars/default_5.webp': 'default_5',
  '/avatars/default_6.webp': 'default_6',
};

/**
 * Normalizes a preset avatar URL or code into its backend wire code (`default_1` ~ `default_6`),
 * or returns `null` when `value` is not a preset avatar.
 */
export function toPresetAvatarCode(
  value: string | null | undefined
): PresetAvatarCode | null {
  if (typeof value !== 'string' || !value) return null;
  const trimmed = value.trim();
  if (PRESET_AVATAR_CODE_SET.has(trimmed)) {
    return trimmed as PresetAvatarCode;
  }
  const { base } = parseAvatarUrl(trimmed);
  return Object.hasOwn(URL_TO_CODE, base) ? URL_TO_CODE[base] : null;
}

/**
 * Resolves a stored avatar value (preset code like `default_3`, local `/avatars/...` URL,
 * or S3 URL) into a displayable `<Image src>` string.
 */
export function resolveAvatarDisplayUrl(
  value: string | null | undefined,
  fallbackToDefault = false
): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    return fallbackToDefault ? CODE_TO_URL[DEFAULT_PRESET_AVATAR_CODE] : '';
  }
  if (PRESET_AVATAR_CODE_SET.has(trimmed)) {
    return CODE_TO_URL[trimmed as PresetAvatarCode];
  }
  return trimmed;
}

/**
 * Returns true when `url` is a single-slash local static path or preset code,
 * excluding protocol-relative URLs (`//...`).
 */
export function isLocalStaticAvatarUrl(
  url: string | null | undefined
): boolean {
  if (typeof url !== 'string' || !url) return false;
  const trimmed = url.trim();
  if (PRESET_AVATAR_CODE_SET.has(trimmed)) return true;
  return trimmed.startsWith('/') && !trimmed.startsWith('//');
}

/**
 * Returns true when `url` points to one of the 6 decoupled Mentee preset
 * illustrations (`default_1` ~ `default_6` or `/avatars/default_1.webp` ~ `/avatars/default_6.webp`).
 */
export function isPresetAvatarUrl(url: string | null | undefined): boolean {
  if (typeof url !== 'string' || !url) return false;
  const trimmed = url.trim();
  if (PRESET_AVATAR_CODE_SET.has(trimmed)) return true;
  const { base } = parseAvatarUrl(trimmed);
  return PRESET_AVATAR_URL_SET.has(base);
}

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

  if (isLocalStaticAvatarUrl(avatarUrl)) {
    const resolved = resolveAvatarDisplayUrl(avatarUrl);
    const { base, hash } = parseAvatarUrl(resolved);
    return `${base}${hash}`;
  }

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

  const expectedParsed = parseAvatarUrl(resolveAvatarDisplayUrl(expected));
  const actualParsed = parseAvatarUrl(resolveAvatarDisplayUrl(actual));

  if (expectedParsed.base !== actualParsed.base) {
    return false;
  }

  return (
    canonicalizeAvatarParams(expectedParsed.params) ===
    canonicalizeAvatarParams(actualParsed.params)
  );
}
