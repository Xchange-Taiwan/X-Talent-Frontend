export const DEFAULT_MENTEE_AVATAR_URL = '/avatars/default_1.webp';

const PRESET_AVATAR_CODE_TO_PATH: Readonly<Record<string, string>> = {
  default_1: '/avatars/default_1.webp',
  default_2: '/avatars/default_2.webp',
  default_3: '/avatars/default_3.webp',
  default_4: '/avatars/default_4.webp',
  default_5: '/avatars/default_5.webp',
  default_6: '/avatars/default_6.webp',
};

/**
 * Normalizes a stored preset avatar code (`default_1` ~ `default_6`) into its
 * static `/avatars/default_*.webp` path, returning `fallback` when blank.
 */
export function normalizePresetAvatarSrc(
  raw: string | null | undefined,
  fallback = ''
): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return fallback;
  return Object.hasOwn(PRESET_AVATAR_CODE_TO_PATH, trimmed)
    ? PRESET_AVATAR_CODE_TO_PATH[trimmed]
    : trimmed;
}
