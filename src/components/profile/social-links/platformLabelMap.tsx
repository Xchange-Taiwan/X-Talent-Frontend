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
  normalizePersonalLinks,
  type PersonalLink,
  SOCIAL_PLATFORM_PLACEHOLDERS,
  SOCIAL_PLATFORM_SHORT_LABELS,
  SOCIAL_PLATFORM_SPECS,
  type SocialPlatformKey,
} from '@/lib/profile/socialLinks';

export interface PlatformLabelEntry {
  label: string;
  shortLabel: string;
  placeholder: string;
  icon: JSX.Element;
}

export interface ResolvedDisplaySocialLink {
  platform: SocialPlatformKey;
  url: string;
  label: string;
  shortLabel: string;
  icon: JSX.Element;
}

const exhaustivePlatformLabelMap = {
  linkedin: {
    label: SOCIAL_PLATFORM_SPECS.linkedin.label,
    shortLabel: SOCIAL_PLATFORM_SHORT_LABELS.linkedin,
    placeholder: SOCIAL_PLATFORM_PLACEHOLDERS.linkedin,
    icon: <LinkedinColor className="size-5" />,
  },
  facebook: {
    label: SOCIAL_PLATFORM_SPECS.facebook.label,
    shortLabel: SOCIAL_PLATFORM_SHORT_LABELS.facebook,
    placeholder: SOCIAL_PLATFORM_PLACEHOLDERS.facebook,
    icon: <FacebookColor className="size-5" />,
  },
  instagram: {
    label: SOCIAL_PLATFORM_SPECS.instagram.label,
    shortLabel: SOCIAL_PLATFORM_SHORT_LABELS.instagram,
    placeholder: SOCIAL_PLATFORM_PLACEHOLDERS.instagram,
    icon: <InstagramColor className="size-5" />,
  },
  twitter: {
    label: SOCIAL_PLATFORM_SPECS.twitter.label,
    shortLabel: SOCIAL_PLATFORM_SHORT_LABELS.twitter,
    placeholder: SOCIAL_PLATFORM_PLACEHOLDERS.twitter,
    icon: <TwitterColor className="size-5" />,
  },
  youtube: {
    label: SOCIAL_PLATFORM_SPECS.youtube.label,
    shortLabel: SOCIAL_PLATFORM_SHORT_LABELS.youtube,
    placeholder: SOCIAL_PLATFORM_PLACEHOLDERS.youtube,
    icon: <YoutubeColor className="size-5" />,
  },
  github: {
    label: SOCIAL_PLATFORM_SPECS.github.label,
    shortLabel: SOCIAL_PLATFORM_SHORT_LABELS.github,
    placeholder: SOCIAL_PLATFORM_PLACEHOLDERS.github,
    icon: <GithubColor className="size-5" />,
  },
  website: {
    label: SOCIAL_PLATFORM_SPECS.website.label,
    shortLabel: SOCIAL_PLATFORM_SHORT_LABELS.website,
    placeholder: SOCIAL_PLATFORM_PLACEHOLDERS.website,
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
  return normalizePersonalLinks(personalLinks).map(({ platform, url }) => {
    const entry = exhaustivePlatformLabelMap[platform];
    return {
      platform,
      url,
      label: entry.label,
      shortLabel: entry.shortLabel,
      icon: entry.icon,
    };
  });
}
