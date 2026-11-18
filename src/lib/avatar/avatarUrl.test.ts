import { describe, expect, it } from 'vitest';

import {
  hasAvatarVersionConverged,
  isLocalStaticAvatarUrl,
  isPresetAvatarUrl,
  PRESET_AVATAR_URLS,
  toAvatarThumbUrl,
  withAvatarVersion,
} from './avatarUrl';

describe('avatarUrl', () => {
  describe('withAvatarVersion', () => {
    it('stamps ?v=<version> on a bare S3 avatar URL by default', () => {
      expect(
        withAvatarVersion(
          'https://s3.amazonaws.com/bucket/files/42/avatar',
          1754000000000
        )
      ).toBe('https://s3.amazonaws.com/bucket/files/42/avatar?v=1754000000000');
    });

    it('appends &cb=<updated_at> onto an already ?v=-stamped URL without producing double-?', () => {
      const uploaded = withAvatarVersion(
        'https://s3.amazonaws.com/bucket/files/42/avatar',
        1754000000000,
        'v'
      );
      const mentorCardAvatar = withAvatarVersion(
        uploaded,
        '2026-11-14T08:30:00Z',
        'cb'
      );

      expect(mentorCardAvatar).toBe(
        'https://s3.amazonaws.com/bucket/files/42/avatar?v=1754000000000&cb=2026-11-14T08%3A30%3A00Z'
      );
      expect(mentorCardAvatar.match(/\?/g)).toHaveLength(1);
    });

    it('replaces an existing matching parameter instead of duplicating it', () => {
      const first =
        'https://s3.amazonaws.com/bucket/files/42/avatar?v=100&cb=old';
      expect(withAvatarVersion(first, 200, 'v')).toBe(
        'https://s3.amazonaws.com/bucket/files/42/avatar?v=200&cb=old'
      );
      expect(withAvatarVersion(first, 'new-ts', 'cb')).toBe(
        'https://s3.amazonaws.com/bucket/files/42/avatar?v=100&cb=new-ts'
      );
    });

    it('heals malformed legacy double-? URLs when stamping a new parameter', () => {
      const legacyMalformed =
        'https://s3.amazonaws.com/bucket/files/42/avatar?v=1754000000000?cb=old';
      expect(withAvatarVersion(legacyMalformed, '2026-11-14', 'cb')).toBe(
        'https://s3.amazonaws.com/bucket/files/42/avatar?v=1754000000000&cb=2026-11-14'
      );
    });

    it('returns the URL unchanged when version is null, undefined, or empty, or URL is empty', () => {
      const url = 'https://s3.amazonaws.com/bucket/files/42/avatar?v=123';
      expect(withAvatarVersion(url, null, 'cb')).toBe(url);
      expect(withAvatarVersion(url, undefined, 'cb')).toBe(url);
      expect(withAvatarVersion(url, '', 'cb')).toBe(url);
      expect(withAvatarVersion('', 123, 'v')).toBe('');
    });

    it('preserves hash fragments while stamping query parameters', () => {
      expect(
        withAvatarVersion(
          'https://example.com/files/42/avatar#profile',
          999,
          'v'
        )
      ).toBe('https://example.com/files/42/avatar?v=999#profile');
    });

    it('omits ?cb= and ?v= query parameters on local static /avatars/ paths for Next.js 16 next/image compatibility (#828)', () => {
      for (const presetUrl of PRESET_AVATAR_URLS) {
        expect(withAvatarVersion(presetUrl, 1754000000000, 'cb')).toBe(
          presetUrl
        );
        expect(withAvatarVersion(presetUrl, 1754000000000, 'v')).toBe(
          presetUrl
        );
      }
      expect(
        withAvatarVersion(
          '/avatars/default_3.webp?cb=stale',
          '2026-11-17',
          'cb'
        )
      ).toBe('/avatars/default_3.webp');
      expect(withAvatarVersion('/default-avatar.png', 123, 'cb')).toBe(
        '/default-avatar.png'
      );
    });
  });

  describe('PRESET_AVATAR_URLS and preset/local helpers (#828)', () => {
    it('exports 6 decoupled /avatars/default_1~6.webp paths', () => {
      expect(PRESET_AVATAR_URLS).toEqual([
        '/avatars/default_1.webp',
        '/avatars/default_2.webp',
        '/avatars/default_3.webp',
        '/avatars/default_4.webp',
        '/avatars/default_5.webp',
        '/avatars/default_6.webp',
      ]);
    });

    it('recognizes only /avatars/default_1~6.webp as preset avatars', () => {
      for (const url of PRESET_AVATAR_URLS) {
        expect(isPresetAvatarUrl(url)).toBe(true);
      }
      expect(isPresetAvatarUrl('/avatars/default_1.webp?cb=123')).toBe(true);
      expect(isPresetAvatarUrl('/avatars/default_0.webp')).toBe(false);
      expect(isPresetAvatarUrl('/avatars/default_7.webp')).toBe(false);
      expect(isPresetAvatarUrl('/landing/slider_default_1.webp')).toBe(false);
      expect(isPresetAvatarUrl('https://example.com/avatar.png')).toBe(false);
      expect(isPresetAvatarUrl('')).toBe(false);
      expect(isPresetAvatarUrl(null)).toBe(false);
      expect(isPresetAvatarUrl(undefined)).toBe(false);
    });

    it('distinguishes single-slash local static paths from protocol-relative or remote URLs', () => {
      expect(isLocalStaticAvatarUrl('/avatars/default_1.webp')).toBe(true);
      expect(isLocalStaticAvatarUrl('/logo.svg')).toBe(true);
      expect(isLocalStaticAvatarUrl('//cdn.example.com/a.webp')).toBe(false);
      expect(isLocalStaticAvatarUrl('https://example.com/a.webp')).toBe(false);
      expect(isLocalStaticAvatarUrl('')).toBe(false);
      expect(isLocalStaticAvatarUrl(null)).toBe(false);
    });
  });

  describe('toAvatarThumbUrl', () => {
    it('replaces trailing /avatar with /avatar-thumb and preserves ?v= and &cb= query params', () => {
      expect(toAvatarThumbUrl('https://example.com/files/123/avatar')).toBe(
        'https://example.com/files/123/avatar-thumb'
      );
      expect(
        toAvatarThumbUrl(
          'https://example.com/files/123/avatar?v=1754000000000&cb=2026-11-14T00%3A00%3A00Z'
        )
      ).toBe(
        'https://example.com/files/123/avatar-thumb?v=1754000000000&cb=2026-11-14T00%3A00%3A00Z'
      );
    });

    it('is idempotent on /avatar-thumb and leaves non-matching or empty inputs untouched', () => {
      expect(
        toAvatarThumbUrl('https://example.com/files/123/avatar-thumb?v=1')
      ).toBe('https://example.com/files/123/avatar-thumb?v=1');
      expect(toAvatarThumbUrl('https://example.com/files/123/photo.png')).toBe(
        'https://example.com/files/123/photo.png'
      );
      expect(toAvatarThumbUrl('')).toBe('');
    });
  });

  describe('hasAvatarVersionConverged', () => {
    it('treats ?v=<same> as converged even when actual appends or reorders &cb=<updated_at>', () => {
      const expected =
        'https://s3.amazonaws.com/bucket/files/42/avatar?v=1754000000000';

      expect(
        hasAvatarVersionConverged(
          expected,
          'https://s3.amazonaws.com/bucket/files/42/avatar?v=1754000000000'
        )
      ).toBe(true);
      expect(
        hasAvatarVersionConverged(
          expected,
          'https://s3.amazonaws.com/bucket/files/42/avatar?v=1754000000000&cb=2026-11-14T00%3A00%3A00Z'
        )
      ).toBe(true);
      expect(
        hasAvatarVersionConverged(
          expected,
          'https://s3.amazonaws.com/bucket/files/42/avatar?cb=2026-11-14T00%3A00%3A00Z&v=1754000000000'
        )
      ).toBe(true);
    });

    it('returns false when ?v= differs, is missing, or is only a string prefix', () => {
      const expected = 'https://s3.amazonaws.com/bucket/files/42/avatar?v=1754';

      expect(
        hasAvatarVersionConverged(
          expected,
          'https://s3.amazonaws.com/bucket/files/42/avatar?v=1753&cb=2026'
        )
      ).toBe(false);
      expect(
        hasAvatarVersionConverged(
          expected,
          'https://s3.amazonaws.com/bucket/files/42/avatar?v=1754999'
        )
      ).toBe(false);
      expect(
        hasAvatarVersionConverged(
          expected,
          'https://s3.amazonaws.com/bucket/files/42/avatar?cb=2026'
        )
      ).toBe(false);
    });

    it('rejects asset path prefix collisions that startsWith previously misclassified', () => {
      expect(
        hasAvatarVersionConverged(
          'https://cdn.example.com/files/42/avatar',
          'https://cdn.example.com/files/42/avatar-legacy.png'
        )
      ).toBe(false);
    });

    it('handles undefined, null, empty string, and non-string StaticImageData fallbacks', () => {
      expect(
        hasAvatarVersionConverged(undefined, 'https://cdn.example.com/any.png')
      ).toBe(true);
      expect(hasAvatarVersionConverged(null, null)).toBe(true);
      expect(hasAvatarVersionConverged(null, '')).toBe(true);
      expect(
        hasAvatarVersionConverged(null, 'https://cdn.example.com/stale.png')
      ).toBe(false);
      expect(
        hasAvatarVersionConverged('https://cdn.example.com/new.png', {
          src: '/default-avatar.png',
          height: 64,
          width: 64,
        })
      ).toBe(false);
    });
  });
});

describe('preset avatar disk assets & code mapping (#959)', () => {
  it('commits all 6 public/avatars/default_1~6.webp files and round-trips preset codes', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { PRESET_AVATAR_URLS, resolveAvatarDisplayUrl, toPresetAvatarCode } =
      await import('./avatarUrl');

    const publicDir = path.resolve(process.cwd(), 'public');
    for (const rel of PRESET_AVATAR_URLS) {
      const p = path.join(publicDir, rel.replace(/^\//, ''));
      expect(fs.existsSync(p)).toBe(true);
    }

    expect(toPresetAvatarCode('/avatars/default_4.webp')).toBe('default_4');
    expect(resolveAvatarDisplayUrl('default_4')).toBe(
      '/avatars/default_4.webp'
    );
    expect(resolveAvatarDisplayUrl('', true)).toBe('/avatars/default_1.webp');
  });
});
