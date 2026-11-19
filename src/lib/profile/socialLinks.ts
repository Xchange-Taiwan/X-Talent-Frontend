import * as z from 'zod';

import { isSafeUrl } from '@/lib/url/isSafeUrl';

export const SOCIAL_PLATFORM_SPECS = {
  linkedin: {
    label: 'LinkedIn',
    allowedHosts: ['linkedin.com'],
  },
  facebook: {
    label: 'Facebook',
    allowedHosts: ['facebook.com', 'fb.com'],
  },
  instagram: {
    label: 'Instagram',
    allowedHosts: ['instagram.com'],
  },
  twitter: {
    label: 'X (formerly Twitter)',
    allowedHosts: ['twitter.com', 'x.com'],
  },
  youtube: {
    label: 'YouTube',
    allowedHosts: ['youtube.com', 'youtu.be'],
  },
  github: {
    label: 'GitHub',
    allowedHosts: ['github.com'],
  },
  website: {
    label: '個人網站',
    allowedHosts: null,
  },
} as const;

export const SOCIAL_PLATFORM_SHORT_LABELS: Readonly<
  Record<keyof typeof SOCIAL_PLATFORM_SPECS, string>
> = {
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'X',
  youtube: 'YouTube',
  github: 'GitHub',
  website: '個人網站',
};

export const SOCIAL_PLATFORM_PLACEHOLDERS: Readonly<
  Record<keyof typeof SOCIAL_PLATFORM_SPECS, string>
> = {
  linkedin: 'https://linkedin.com/in/yourname',
  facebook: 'https://facebook.com/yourname',
  instagram: 'https://instagram.com/yourname',
  twitter: 'https://x.com/yourname',
  youtube: 'https://youtube.com/@yourname',
  github: 'https://github.com/yourname',
  website: 'https://your-portfolio.com',
};

export type SocialPlatformKey = keyof typeof SOCIAL_PLATFORM_SPECS;

export interface PersonalLink {
  platform: string;
  url: string;
}

export type PlatformUrlValidationResult =
  { valid: true; normalizedUrl: string } | { valid: false; message: string };

export function isSocialPlatformKey(value: string): value is SocialPlatformKey {
  return Object.prototype.hasOwnProperty.call(SOCIAL_PLATFORM_SPECS, value);
}

export const SOCIAL_PLATFORM_KEYS: readonly SocialPlatformKey[] = Object.keys(
  SOCIAL_PLATFORM_SPECS
).filter(isSocialPlatformKey);

function buildPlatformRecord<V>(
  mapper: (platform: SocialPlatformKey) => V
): Record<SocialPlatformKey, V> {
  const entries = SOCIAL_PLATFORM_KEYS.map(
    (platform) => [platform, mapper(platform)] as const
  );
  return Object.fromEntries(entries) as Record<SocialPlatformKey, V>;
}

export function createEmptySocialLinks(): Record<SocialPlatformKey, string> {
  return buildPlatformRecord(() => '');
}

export function getPlatformUrlErrorMessage(
  platform: SocialPlatformKey
): string {
  const spec = SOCIAL_PLATFORM_SPECS[platform];
  if (!spec.allowedHosts) {
    return '請輸入有效的 HTTPS 網址（例如 https://example.com）';
  }
  return `請輸入有效的 ${spec.label} HTTPS 網址（允許網域：${spec.allowedHosts.join('、')}）`;
}

function hasExplicitScheme(input: string): boolean {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) {
    return true;
  }
  const colonMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):(.*)$/.exec(input);
  if (!colonMatch) {
    return false;
  }
  const [, beforeColon, afterColon] = colonMatch;
  // Allow scheme-omitted `domain.tld:port` (e.g. `example.com:8443/path`)
  // to receive auto-prepended `https://`, while treating any other `scheme:`
  // (`javascript:`, `data:`, `mailto:`, etc.) as an explicit scheme.
  if (beforeColon.includes('.') && /^\d+(?:[/?#]|$)/.test(afterColon)) {
    return false;
  }
  return true;
}

export function validatePlatformUrl(
  platform: SocialPlatformKey,
  rawUrl: string
): PlatformUrlValidationResult {
  const trimmed = rawUrl.trim();
  if (trimmed === '') {
    return { valid: true, normalizedUrl: '' };
  }

  const errorMessage = getPlatformUrlErrorMessage(platform);

  if (/\s/.test(trimmed) || trimmed.startsWith('//')) {
    return { valid: false, message: errorMessage };
  }

  let candidate: string;
  if (hasExplicitScheme(trimmed)) {
    if (!/^https:\/\//i.test(trimmed)) {
      return { valid: false, message: errorMessage };
    }
    candidate = trimmed.replace(/^https:\/\//i, 'https://');
  } else {
    candidate = `https://${trimmed}`;
  }

  if (!isSafeUrl(candidate)) {
    return { valid: false, message: errorMessage };
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { valid: false, message: errorMessage };
  }

  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    return { valid: false, message: errorMessage };
  }

  const host = parsed.hostname.toLowerCase();
  const hostLabels = host.split('.');
  const tldLabel = hostLabels[hostLabels.length - 1] ?? '';
  const hasValidDnsLabels =
    !host.startsWith('[') &&
    !host.startsWith('.') &&
    !host.endsWith('.') &&
    hostLabels.length >= 2 &&
    hostLabels.every((label) => label.length > 0) &&
    !/^\d+$/.test(tldLabel);

  if (!hasValidDnsLabels) {
    return { valid: false, message: errorMessage };
  }

  const allowedHosts = SOCIAL_PLATFORM_SPECS[platform].allowedHosts;
  if (allowedHosts !== null) {
    const matchesAllowedHost = allowedHosts.some((domain) => {
      const d = domain.toLowerCase();
      return host === d || host.endsWith(`.${d}`);
    });
    if (!matchesAllowedHost) {
      return { valid: false, message: errorMessage };
    }
  }

  return { valid: true, normalizedUrl: candidate };
}

export function createPlatformUrlSchema(platform: SocialPlatformKey) {
  return z.string().transform((rawValue, ctx) => {
    const result = validatePlatformUrl(platform, rawValue);
    if (!result.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.message,
      });
      return z.NEVER;
    }
    return result.normalizedUrl;
  });
}

export const socialLinksFormSchema = z.object(
  buildPlatformRecord((platform) => createPlatformUrlSchema(platform))
);
