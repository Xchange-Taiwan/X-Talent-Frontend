import Link from 'next/link';
import { forwardRef, memo, useMemo } from 'react';

import { MentorBookmarkButton } from '@/components/favorites';
import type { FavoriteMentorFeature } from '@/hooks/favorites';
import { isFavoritesEnabled, isFeedbackEnabled } from '@/lib/featureFlags';
import {
  type MentorCardProjectionOptions,
  projectMentorCard,
} from '@/lib/mentor/mentorCardModel';
import { FOCUS_WITHIN_RING_CLASSES } from '@/lib/ui/focusRing';
import { HOVER_CLICKABLE_CARD_CLASSES } from '@/lib/ui/hoverStyles';
import { cn } from '@/lib/utils';
import type { MentorType } from '@/types/mentor';

import { AvatarWithBadge } from './AvatarWithBadge';
import { Information } from './Information';

export type MentorCardAnalyticsLocation = 'mentor_pool_list' | 'favorites_list';

export interface MentorCardProps extends MentorCardProjectionOptions {
  mentor: MentorType;
  priority?: boolean;
  feature?: FavoriteMentorFeature;
  analyticsLocation?: MentorCardAnalyticsLocation;
  showBookmark?: boolean;
}

const MentorCardBase = forwardRef<HTMLElement, MentorCardProps>(
  (
    {
      mentor,
      labelMap,
      prioritizedCodes,
      includeRating,
      showBookmark,
      priority = false,
      feature = 'mentor_pool',
      analyticsLocation,
    }: MentorCardProps,
    ref
  ) => {
    const favoritesEnabled = showBookmark ?? isFavoritesEnabled();
    const effectiveIncludeRating = includeRating ?? isFeedbackEnabled();
    const viewModel = useMemo(
      () =>
        projectMentorCard(mentor, {
          labelMap,
          prioritizedCodes,
          includeRating: effectiveIncludeRating,
        }),
      [effectiveIncludeRating, labelMap, mentor, prioritizedCodes]
    );

    const resolvedAnalyticsLocation: MentorCardAnalyticsLocation =
      analyticsLocation ??
      (feature === 'favorites' ? 'favorites_list' : 'mentor_pool_list');

    return (
      <article
        ref={ref}
        className={cn(
          'border-background-border bg-background-white relative flex h-full w-[334px] flex-col overflow-hidden rounded-lg border transition-shadow md:w-full md:max-w-[413px] xl:min-h-[480px]',
          HOVER_CLICKABLE_CARD_CLASSES,
          FOCUS_WITHIN_RING_CLASSES
        )}
      >
        <Link
          href={`/profile/${viewModel.id}`}
          prefetch={false}
          aria-label={`前往 ${viewModel.name} 的個人頁面`}
          data-analytics-click="mentor_card"
          data-analytics-event="mentor_card_click"
          data-analytics-feature={feature}
          data-analytics-location={resolvedAnalyticsLocation}
          data-analytics-param-mentor-id={String(viewModel.id)}
          className="absolute inset-0 z-10"
        ></Link>
        {favoritesEnabled && (
          <MentorBookmarkButton
            mentorId={viewModel.id}
            mentorName={viewModel.name}
            mentorSnapshot={viewModel.mentorSnapshot}
            feature={feature}
            variant="overlay"
            tooltipSide="bottom"
            tooltipAlign="end"
            wrapperClassName="absolute top-3 right-3 z-20"
          />
        )}
        <AvatarWithBadge
          avatar={viewModel.avatar}
          years={viewModel.yearsOfExperienceLabel}
          name={viewModel.name}
          priority={priority}
        />
        <div className="flex flex-1 flex-col px-4 pt-4 pb-6">
          <Information
            name={viewModel.name}
            job_title={viewModel.jobTitle}
            company={viewModel.company}
            about={viewModel.about}
            haveTopicLabels={viewModel.tags}
            ratingLabel={viewModel.ratingLabel}
            completedMeetingsLabel={viewModel.completedMeetingsLabel}
          />
        </div>
      </article>
    );
  }
);

MentorCardBase.displayName = 'MentorCard';

export const MentorCard = memo(MentorCardBase);
