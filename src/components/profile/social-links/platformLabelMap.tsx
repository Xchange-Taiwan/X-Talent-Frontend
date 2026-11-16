import {
  FacebookColor,
  GithubColor,
  InstagramColor,
  LinkedinColor,
  TwitterColor,
  WebsiteColor,
  YoutubeColor,
} from '@/components/icon';
import {
  isSocialPlatformKey,
  type PersonalLink,
  SOCIAL_PLATFORM_KEYS,
  SOCIAL_PLATFORM_SPECS,
  type SocialPlatformKey,
  validatePlatformUrl,
} from '@/lib/profile/socialLinks';
import { isSafeUrl } from '@/lib/url/isSafeUrl';

export interface PlatformLabelEntry {
  label: string;
  icon: JSX.Element;
}

export interface ResolvedDisplaySocialLink {
  platform: SocialPlatformKey;
  url: string;
  label: string;
  icon: JSX.Element;
}

const exhaustivePlatformLabelMap = {
  linkedin: {
    label: SOCIAL_PLATFORM_SPECS.linkedin.label,
    icon: <LinkedinColor className="size-5" />,
  },
  facebook: {
    label: SOCIAL_PLATFORM_SPECS.facebook.label,
    icon: <FacebookColor className="size-5" />,
  },
  instagram: {
    label: SOCIAL_PLATFORM_SPECS.instagram.label,
    icon: <InstagramColor className="size-5" />,
  },
  twitter: {
    label: SOCIAL_PLATFORM_SPECS.twitter.label,
    icon: <TwitterColor className="size-5" />,
  },
  youtube: {
    label: SOCIAL_PLATFORM_SPECS.youtube.label,
    icon: <YoutubeColor className="size-5" />,
  },
  github: {
    label: SOCIAL_PLATFORM_SPECS.github.label,
    icon: <GithubColor className="size-5" />,
  },
  website: {
    label: SOCIAL_PLATFORM_SPECS.website.label,
    icon: <WebsiteColor className="size-5" />,
  },
} satisfies Record<SocialPlatformKey, PlatformLabelEntry>;

export const platformLabelMap: Record<SocialPlatformKey, PlatformLabelEntry> &
  Readonly<Record<string, PlatformLabelEntry | undefined>> =
  exhaustivePlatformLabelMap;

export function getPlatformLabelEntry(
  platform: string | null | undefined
): PlatformLabelEntry | undefined {
  if (typeof platform !== 'string') return undefined;
  const normalized = platform.trim().toLowerCase();
  if (!isSocialPlatformKey(normalized)) return undefined;
  return exhaustivePlatformLabelMap[normalized];
}

export function resolveDisplaySocialLinks(
  personalLinks: readonly PersonalLink[] | null | undefined
): ResolvedDisplaySocialLink[] {
  if (!personalLinks?.length) return [];

  const resolvedByPlatform = new Map<
    SocialPlatformKey,
    ResolvedDisplaySocialLink
  >();

  for (const link of personalLinks) {
    if (!link || typeof link.url !== 'string') {
      continue;
    }
    const normalizedPlatform =
      typeof link.platform === 'string'
        ? link.platform.trim().toLowerCase()
        : '';
    if (!isSocialPlatformKey(normalizedPlatform)) {
      continue;
    }
    const validation = validatePlatformUrl(normalizedPlatform, link.url);
    if (
      !validation.valid ||
      !validation.normalizedUrl ||
      !isSafeUrl(validation.normalizedUrl)
    ) {
      continue;
    }
    const entry = exhaustivePlatformLabelMap[normalizedPlatform];
    resolvedByPlatform.set(normalizedPlatform, {
      platform: normalizedPlatform,
      url: validation.normalizedUrl,
      label: entry.label,
      icon: entry.icon,
    });
  }

  return SOCIAL_PLATFORM_KEYS.flatMap((platform) => {
    const item = resolvedByPlatform.get(platform);
    return item ? [item] : [];
  });
}
