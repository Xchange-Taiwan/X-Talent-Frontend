import { StaticImageData } from 'next/image';
import Link from 'next/link';
import { forwardRef, memo } from 'react';

import { MentorBookmarkButton } from '@/components/favorites';
import { FOCUS_WITHIN_RING_CLASSES } from '@/lib/ui/focusRing';
import { HOVER_CLICKABLE_CARD_CLASSES } from '@/lib/ui/hoverStyles';
import { cn } from '@/lib/utils';
import type { MentorType } from '@/types/mentor';

import { AvatarWithBadge } from './AvatarWithBadge';
import { Information } from './Information';

export interface MentorCardProps {
  id: number;
  avatar: string | StaticImageData;
  years: string;
  name: string;
  job_title: string;
  company: string;
  about: string;
  haveTopicLabels: string[];
  ratingAverage?: number | null;
  completedMeetingCount?: number | null;
  priority?: boolean;
  mentorSnapshot?: MentorType;
}

const MentorCardBase = forwardRef<HTMLElement, MentorCardProps>(
  (
    {
      id,
      avatar,
      years,
      name,
      job_title,
      company,
      about,
      haveTopicLabels,
      ratingAverage = null,
      completedMeetingCount = null,
      priority = false,
      mentorSnapshot,
    }: MentorCardProps,
    ref
  ) => {
    return (
      <article
        ref={ref}
        className={cn(
          'border-background-border bg-background-white relative flex h-full w-[334px] flex-col overflow-hidden rounded-lg border transition-shadow xl:min-h-[480px] xl:w-[413px]',
          HOVER_CLICKABLE_CARD_CLASSES,
          FOCUS_WITHIN_RING_CLASSES
        )}
      >
        <Link
          href={`/profile/${id}`}
          aria-label={`前往 ${name} 的個人頁面`}
          data-analytics-click="mentor_card"
          data-analytics-event="mentor_card_click"
          data-analytics-feature="mentor_pool"
          data-analytics-location="mentor_pool_list"
          data-analytics-param-mentor-id={String(id)}
          className="absolute inset-0 z-10"
        ></Link>
        <MentorBookmarkButton
          mentorId={id}
          mentorName={name}
          mentorSnapshot={mentorSnapshot}
          variant="overlay"
          tooltipSide="bottom"
          tooltipAlign="end"
          wrapperClassName="absolute top-3 right-3 z-20"
        />
        <AvatarWithBadge
          avatar={avatar}
          years={years}
          name={name}
          priority={priority}
        />
        <div className="flex flex-1 flex-col px-4 pt-4 pb-6">
          <Information
            name={name}
            job_title={job_title}
            company={company}
            about={about}
            haveTopicLabels={haveTopicLabels}
            ratingAverage={ratingAverage}
            completedMeetingCount={completedMeetingCount}
          />
        </div>
      </article>
    );
  }
);

MentorCardBase.displayName = 'MentorCard';

export const MentorCard = memo(MentorCardBase);
