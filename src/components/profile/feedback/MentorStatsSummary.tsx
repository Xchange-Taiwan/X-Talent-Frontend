'use client';

import { Star, Users } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { formatMentorScoreNumber } from '@/lib/mentor/mentorStats';
import { cn } from '@/lib/utils';

export const EMPTY_MENTOR_FEEDBACK_MESSAGE =
  '尚未有任何評價，您可以成為第一個預約的 Mentee！';

export const EMPTY_OWN_MENTOR_STATS_MESSAGE = '目前尚無已完成會談與評價紀錄';

export interface MentorStatsSummaryProps {
  ratingAverage: number | null;
  totalRatingCount: number;
  completedMeetingCount: number;
  isOwnMentorProfile?: boolean;
  isLoading?: boolean;
}

export function MentorStatsSummary({
  ratingAverage,
  totalRatingCount,
  completedMeetingCount,
  isOwnMentorProfile = false,
  isLoading = false,
}: MentorStatsSummaryProps) {
  const scoreText =
    totalRatingCount > 0 ? formatMentorScoreNumber(ratingAverage) : null;
  const hasCompletedMeetings = completedMeetingCount > 0;

  if (!scoreText && !hasCompletedMeetings) {
    if (isLoading) {
      return (
        <section
          aria-label="導師會談摘要"
          aria-busy="true"
          className="border-background-border mb-8 flex min-h-[54px] items-center border-y py-4"
        >
          <Skeleton className="h-5 w-56" />
        </section>
      );
    }

    return (
      <section
        aria-label="導師會談摘要"
        className="border-background-border mb-8 flex min-h-[54px] items-center gap-2.5 border-y py-4"
      >
        <Star className="text-brand-600 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="text-text-secondary text-sm">
          {isOwnMentorProfile
            ? EMPTY_OWN_MENTOR_STATS_MESSAGE
            : EMPTY_MENTOR_FEEDBACK_MESSAGE}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="導師會談摘要"
      className="border-background-border mb-8 flex flex-wrap items-center border-y py-4"
    >
      {scoreText && (
        <div className="flex flex-col gap-1 pr-6 sm:pr-10 md:pr-12">
          <div className="text-text-tertiary flex items-center gap-1.5 text-xs font-medium">
            <Star
              className="fill-brand-600 text-brand-600 h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>評分</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-text-primary text-xl font-bold tracking-tight sm:text-2xl">
              {scoreText}
            </span>
            <span className="text-text-tertiary text-xs sm:text-sm">/ 10</span>
          </div>
        </div>
      )}

      {hasCompletedMeetings && (
        <div
          className={cn(
            'flex flex-col gap-1',
            scoreText &&
              'border-background-border border-l pl-6 sm:pl-10 md:pl-12'
          )}
        >
          <div className="text-text-tertiary flex items-center gap-1.5 text-xs font-medium">
            <Users
              className="text-text-tertiary h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>已完成 1-on-1</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-text-primary text-xl font-bold tracking-tight sm:text-2xl">
              {completedMeetingCount}
            </span>
            <span className="text-text-tertiary text-xs sm:text-sm">場</span>
          </div>
        </div>
      )}
    </section>
  );
}
