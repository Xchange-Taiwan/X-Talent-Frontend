import { describe, expect,it } from 'vitest';

import { getAvatarThumbUrl } from './getAvatarThumbUrl';

describe('getAvatarThumbUrl', () => {
  it('should return empty/falsy value as is', () => {
    expect(getAvatarThumbUrl('')).toBe('');
    // @ts-expect-error - testing unexpected falsy inputs
    expect(getAvatarThumbUrl(null)).toBe(null);
    // @ts-expect-error - testing unexpected falsy inputs
    expect(getAvatarThumbUrl(undefined)).toBe(undefined);
  });

  it('should replace trailing /avatar with /avatar-thumb when no query parameters are present', () => {
    expect(getAvatarThumbUrl('https://example.com/files/123/avatar')).toBe(
      'https://example.com/files/123/avatar-thumb'
    );
  });

  it('should replace trailing /avatar with /avatar-thumb and preserve query parameters', () => {
    expect(
      getAvatarThumbUrl('https://example.com/files/123/avatar?cb=1234567890')
    ).toBe('https://example.com/files/123/avatar-thumb?cb=1234567890');
    expect(
      getAvatarThumbUrl('https://example.com/files/123/avatar?v=1&foo=bar')
    ).toBe('https://example.com/files/123/avatar-thumb?v=1&foo=bar');
  });

  it('should preserve unexpected formats / non-avatar URLs', () => {
    expect(getAvatarThumbUrl('https://example.com/files/123/other')).toBe(
      'https://example.com/files/123/other'
    );
    expect(getAvatarThumbUrl('https://example.com/avatar/other')).toBe(
      'https://example.com/avatar/other'
    );
    expect(getAvatarThumbUrl('https://example.com/avatar-other?cb=123')).toBe(
      'https://example.com/avatar-other?cb=123'
    );
    expect(getAvatarThumbUrl('https://example.com/files/123/avatar/')).toBe(
      'https://example.com/files/123/avatar/'
    );
  });
});
