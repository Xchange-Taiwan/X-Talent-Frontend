import { ArrowUpRight } from 'lucide-react';
import React, { useMemo } from 'react';

import {
  SOCIAL_PLATFORM_KEYS,
  type SocialPlatformKey,
} from '@/lib/profile/socialLinks';
import { FOCUS_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

import {
  platformLabelMap,
  type ResolvedDisplaySocialLink,
} from './platformLabelMap';

export interface PersonalLinksGridProps {
  links: ReadonlyArray<ResolvedDisplaySocialLink>;
  userId?: string | number;
  location?: string;
}

export function PersonalLinksGrid({
  links,
  userId,
  location = 'profile_links_section',
}: PersonalLinksGridProps): React.ReactElement {
  const linkByPlatform = useMemo(() => {
    const map = new Map<SocialPlatformKey, ResolvedDisplaySocialLink>();
    for (const item of links) {
      map.set(item.platform, item);
    }
    return map;
  }, [links]);

  return (
    <nav
      aria-label="個人連結"
      className="grid grid-cols-2 gap-x-5 gap-y-3 p-0.5 sm:grid-cols-3"
    >
      {SOCIAL_PLATFORM_KEYS.map((platform) => {
        const entry = platformLabelMap[platform];
        const activeLink = linkByPlatform.get(platform);
        const displayLabel = entry.shortLabel;

        if (activeLink) {
          return (
            <a
              key={platform}
              href={activeLink.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={entry.label}
              title={entry.label}
              data-analytics-click="profile_social_link"
              data-analytics-event="profile_social_link_click"
              data-analytics-feature="profile"
              data-analytics-location={location}
              data-analytics-omit-destination="true"
              data-analytics-param-platform={platform}
              data-analytics-param-mentor-id={
                userId !== undefined ? String(userId) : undefined
              }
              className={cn(
                FOCUS_RING_NO_OFFSET_CLASSES,
                'text-brand-700 hover:bg-brand-50 inline-flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-normal transition-colors'
              )}
            >
              <span className="flex size-5 shrink-0 items-center justify-center">
                {entry.icon}
              </span>
              <span className="truncate">{displayLabel}</span>
              <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
            </a>
          );
        }

        return (
          <span
            key={platform}
            aria-disabled="true"
            className="text-text-tertiary inline-flex min-h-[44px] cursor-default items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-normal"
          >
            <span
              aria-hidden="true"
              className="flex size-5 shrink-0 items-center justify-center opacity-45 grayscale"
            >
              {entry.icon}
            </span>
            <span className="truncate">{displayLabel}</span>
          </span>
        );
      })}
    </nav>
  );
}
