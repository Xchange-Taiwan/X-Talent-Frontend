import { describe, expect, it } from 'vitest';

import {
  hasAvatarVersionConverged,
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
