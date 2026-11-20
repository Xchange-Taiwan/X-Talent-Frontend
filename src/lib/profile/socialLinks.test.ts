import { describe, expect, it } from 'vitest';

import { decode, encode, toFormValues } from '@/lib/profile/experienceCodec';
import { extractValidLinks } from '@/lib/profile/profileSaveAdapter';
import { defaultValues } from '@/schemas/profileSchema';

import {
  createEmptySocialLinks,
  getPlatformUrlErrorMessage,
  normalizePersonalLinks,
  SOCIAL_PLATFORM_KEYS,
  SOCIAL_PLATFORM_SPECS,
  socialLinksFormSchema,
  type SocialPlatformKey,
  validatePlatformUrl,
} from './socialLinks';

describe('socialLinks registry & URL validation (#898, #862)', () => {
  it('registers all 7 platforms in canonical order with github between youtube and website while keeping facebook', () => {
    expect(SOCIAL_PLATFORM_KEYS).toEqual([
      'linkedin',
      'facebook',
      'instagram',
      'twitter',
      'youtube',
      'github',
      'website',
    ]);
    expect(SOCIAL_PLATFORM_SPECS.github).toEqual({
      label: 'GitHub',
      allowedHosts: ['github.com'],
    });
    expect(getPlatformUrlErrorMessage('github')).toBe(
      '請輸入有效的 GitHub HTTPS 網址（允許網域：github.com）'
    );
  });

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
    ['github', 'github.com/octocat', 'https://github.com/octocat'],
    ['github', '  www.github.com/octocat  ', 'https://www.github.com/octocat'],
    [
      'github',
      'https://gist.github.com/octocat',
      'https://gist.github.com/octocat',
    ],
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
    ['github', 'http://github.com/octocat'],
    ['github', 'https://gitlab.com/octocat'],
    ['github', 'gitlab.com/octocat'],
    ['github', 'https://evil-github.com/octocat'],
    ['github', 'https://github.com.attacker.io/octocat'],
    ['github', 'javascript:alert(1)'],
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
      github: 'github.com/janedoe',
      website: 'janedoe.dev',
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
      github: 'https://github.com/janedoe',
      website: 'https://janedoe.dev',
    });

    const validLinks = extractValidLinks({
      ...defaultValues,
      links: parsedLinks,
    });
    expect(validLinks).toHaveLength(SOCIAL_PLATFORM_KEYS.length);
    expect(validLinks.map((item) => item.platform)).toEqual([
      ...SOCIAL_PLATFORM_KEYS,
    ]);

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

  it('normalizes personalLinks with HTTPS coercion, host allowlists, first-valid deduplication, and canonical platform order (#945)', () => {
    expect(
      normalizePersonalLinks([
        { platform: 'website', url: 'example.com' },
        { platform: 'website', url: 'https://second.example.com' },
        { platform: 'linkedin', url: 'https://evil-linkedin.com/in/attacker' },
        { platform: ' LinkedIn ', url: 'linkedin.com/in/first-valid' },
        { platform: 'linkedin', url: 'https://linkedin.com/in/duplicate' },
        { platform: 'unknown', url: 'https://example.com' },
      ])
    ).toEqual([
      { platform: 'linkedin', url: 'https://linkedin.com/in/first-valid' },
      { platform: 'website', url: 'https://example.com' },
    ]);
    expect(normalizePersonalLinks(null)).toEqual([]);
    expect(normalizePersonalLinks(undefined)).toEqual([]);
  });
});
