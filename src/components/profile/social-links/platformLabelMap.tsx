import {
  FacebookColor,
  InstagramColor,
  LinkedinColor,
  TwitterColor,
  WebsiteColor,
  YoutubeColor,
} from '@/components/icon';
import {
  isSocialPlatformKey,
  SOCIAL_PLATFORM_SPECS,
  type SocialPlatformKey,
} from '@/lib/profile/socialLinks';

export interface PlatformLabelEntry {
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
