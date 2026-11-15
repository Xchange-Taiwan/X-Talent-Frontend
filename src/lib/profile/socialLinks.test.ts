import { describe, expect, it } from 'vitest';

import { decode, encode, toFormValues } from '@/lib/profile/experienceCodec';
import { extractValidLinks } from '@/lib/profile/profileSaveAdapter';
import { defaultValues } from '@/schemas/profileSchema';

import {
  createEmptySocialLinks,
  SOCIAL_PLATFORM_KEYS,
  SOCIAL_PLATFORM_SPECS,
  socialLinksFormSchema,
  type SocialPlatformKey,
  validatePlatformUrl,
} from './socialLinks';

describe('socialLinks registry & URL validation (#898)', () => {
  it('creates an empty record covering every registered platform key', () => {
    const empty = createEmptySocialLinks();
    expect(Object.keys(empty)).toEqual([...SOCIAL_PLATFORM_KEYS]);
    for (const key of SOCIAL_PLATFORM_KEYS) {
      expect(empty[key]).toBe('');
    }
  });

  it.each([
    ['linkedin', 'linkedin.com/in/alice', 'https://linkedin.com/in/alice'],
    [
      'linkedin',
      '  www.linkedin.com/in/alice  ',
      'https://www.linkedin.com/in/alice',
    ],
    ['facebook', 'facebook.com/alice', 'https://facebook.com/alice'],
    ['facebook', 'fb.com/alice', 'https://fb.com/alice'],
    ['instagram', 'instagram.com/alice', 'https://instagram.com/alice'],
    ['twitter', 'twitter.com/alice', 'https://twitter.com/alice'],
    ['twitter', 'x.com/alice', 'https://x.com/alice'],
    ['youtube', 'youtube.com/@alice', 'https://youtube.com/@alice'],
    ['youtube', 'youtu.be/dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ'],
    ['website', 'github.com/user', 'https://github.com/user'],
    [
      'website',
      'example.com:8443/portfolio',
      'https://example.com:8443/portfolio',
    ],
  ] as const)(
    'normalizes scheme-omitted %s input %j -> %j',
    (platform, rawInput, expected) => {
      const result = validatePlatformUrl(platform, rawInput);
      expect(result).toEqual({ valid: true, normalizedUrl: expected });
    }
  );

  it.each([
    ['linkedin', 'http://linkedin.com/in/alice'],
    ['linkedin', 'https://evil-linkedin.com/in/alice'],
    ['linkedin', 'evil-linkedin.com/in/alice'],
    ['linkedin', 'https://linkedin.com.attacker.io/in/alice'],
    ['linkedin', 'https:linkedin.com/in/alice'],
    ['linkedin', '//linkedin.com/in/alice'],
    ['linkedin', 'javascript:alert(1)'],
    ['linkedin', 'https://user:pass@linkedin.com/in/alice'],
    ['facebook', 'https://notfacebook.com/alice'],
    ['instagram', 'https://evil-instagram.com/alice'],
    ['twitter', 'http://x.com/alice'],
    ['twitter', 'https://fakex.com/alice'],
    ['youtube', 'https://myyoutube.com/@alice'],
    ['website', 'http://example.com'],
    ['website', 'javascript:alert(1)'],
    ['website', 'data:text/html,<script>alert(1)</script>'],
    ['website', 'mailto:alice@example.com'],
    ['website', 'localhost'],
    ['website', 'https://localhost:3000'],
    ['website', 'https://127.0.0.1/admin'],
    ['website', 'not a url'],
  ] as const)(
    'rejects unsafe, explicit non-HTTPS, or lookalike %s URL %j',
    (platform, invalidInput) => {
      const result = validatePlatformUrl(platform, invalidInput);
      expect(result.valid).toBe(false);

      const parsed = socialLinksFormSchema.safeParse({
        ...createEmptySocialLinks(),
        [platform]: invalidInput,
      });
      expect(parsed.success).toBe(false);
    }
  );

  it('round-trips every accepted platform URL through socialLinksFormSchema -> extractValidLinks -> encode -> decode -> toFormValues with zero data loss', () => {
    const rawFormLinks: Record<SocialPlatformKey, string> = {
      linkedin: 'www.linkedin.com/in/jane-doe',
      facebook: 'fb.com/janedoe',
      instagram: 'https://www.instagram.com/janedoe',
      twitter: 'x.com/janedoe',
      youtube: 'youtu.be/abc123XYZ',
      website: 'github.com/janedoe',
    };

    // Ensure test covers 100% of SOCIAL_PLATFORM_SPECS keys
    expect(Object.keys(rawFormLinks).sort()).toEqual(
      Object.keys(SOCIAL_PLATFORM_SPECS).sort()
    );

    const parsedLinks = socialLinksFormSchema.parse(rawFormLinks);
    expect(parsedLinks).toEqual({
      linkedin: 'https://www.linkedin.com/in/jane-doe',
      facebook: 'https://fb.com/janedoe',
      instagram: 'https://www.instagram.com/janedoe',
      twitter: 'https://x.com/janedoe',
      youtube: 'https://youtu.be/abc123XYZ',
      website: 'https://github.com/janedoe',
    });

    const validLinks = extractValidLinks({
      ...defaultValues,
      links: parsedLinks,
    });
    expect(validLinks).toHaveLength(SOCIAL_PLATFORM_KEYS.length);

    const { experiences } = encode({
      workExperiences: [],
      educations: [],
      personalLinks: validLinks,
    });

    const decoded = decode(experiences);
    expect(decoded.personalLinks).toEqual(validLinks);

    const rehydrated = toFormValues(experiences);
    expect(rehydrated.links).toEqual(parsedLinks);
  });
});
