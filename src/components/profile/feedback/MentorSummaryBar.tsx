'use client';

import { Briefcase, MapPin, Star, Users } from 'lucide-react';

import type { TagDisplay } from '@/hooks/user/user-data/useUserData';
import {
  formatRatingScoreValue,
  splitExperienceDisplay,
  toNonNegativeInt,
} from '@/lib/mentor/mentorStats';
import { cn } from '@/lib/utils';

export interface MentorSummaryBarProps {
  ratingAverage?: number | null;
  ratingCount?: number | null;
  completedMeetingCount?: number | null;
  yearsOfExperience?: string;
  location?: string;
  industries?: TagDisplay[];
  className?: string;
}

export function MentorSummaryBar({
  ratingAverage = null,
  ratingCount = 0,
  completedMeetingCount = 0,
  yearsOfExperience,
  location,
  industries = [],
  className,
}: MentorSummaryBarProps) {
  const safeRatingCount = toNonNegativeInt(ratingCount);
  const formattedScore =
    safeRatingCount > 0 ? formatRatingScoreValue(ratingAverage) : null;
  const hasRating = formattedScore !== null;
  const safeCompletedCount = toNonNegativeInt(completedMeetingCount);
  const experienceParts = splitExperienceDisplay(yearsOfExperience);
  const locationLabel = location?.trim() || '—';

  return (
    <section aria-label="導師摘要資訊" className={cn('mb-6 w-full', className)}>
      <div
        className={cn(
          'border-background-border grid border-y py-5',
          hasRating
            ? 'grid-cols-2 gap-y-5 md:grid-cols-4 md:gap-y-0'
            : 'grid-cols-1 gap-y-4 sm:grid-cols-3 sm:gap-y-0'
        )}
      >
        {hasRating && (
          <div className="pr-4 md:pr-8">
            <div className="text-text-tertiary mb-1.5 flex items-center gap-1.5 text-xs font-medium">
              <Star
                className="fill-brand-700 text-brand-700 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>評分</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-text-primary text-2xl font-bold tracking-tight">
                {formattedScore}
              </span>
              <span className="text-text-tertiary text-sm font-normal">
                / 10
              </span>
            </div>
          </div>
        )}

        <div
          className={cn(
            hasRating
              ? 'border-background-border border-l pl-4 md:px-8'
              : 'sm:pr-8'
          )}
        >
          <div className="text-text-tertiary mb-1.5 flex items-center gap-1.5 text-xs font-medium">
            <Users
              className="text-text-tertiary size-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>已完成 1-on-1</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-text-primary text-2xl font-bold tracking-tight">
              {safeCompletedCount}
            </span>
            <span className="text-text-secondary text-sm font-normal">場</span>
          </div>
        </div>

        <div
          className={cn(
            hasRating
              ? 'md:border-background-border pr-4 md:border-l md:px-8'
              : 'sm:border-background-border sm:border-l sm:px-8'
          )}
        >
          <div className="text-text-tertiary mb-1.5 flex items-center gap-1.5 text-xs font-medium">
            <Briefcase
              className="text-text-tertiary size-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>經驗</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-text-primary text-2xl font-bold tracking-tight">
              {experienceParts.primary}
            </span>
            {experienceParts.unit && (
              <span className="text-text-secondary text-sm font-normal">
                {experienceParts.unit}
              </span>
            )}
          </div>
        </div>

        <div
          className={cn(
            hasRating
              ? 'border-background-border border-l pl-4 md:pl-8'
              : 'sm:border-background-border sm:border-l sm:pl-8'
          )}
        >
          <div className="text-text-tertiary mb-1.5 flex items-center gap-1.5 text-xs font-medium">
            <MapPin
              className="text-text-tertiary size-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>地點</span>
          </div>
          <div className="flex items-baseline">
            <span className="text-text-primary text-2xl font-bold tracking-tight">
              {locationLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 pt-4">
        <span className="text-text-tertiary mr-1 shrink-0 text-xs font-medium">
          產業
        </span>
        {industries.length > 0 ? (
          industries.map((item) => (
            <span
              key={item.subject_group}
              className="border-background-border bg-background-bottom text-text-secondary inline-flex items-center rounded-full border px-3.5 py-1 text-xs font-medium"
            >
              {item.subject}
            </span>
          ))
        ) : (
          <span className="text-text-tertiary text-xs">未提供</span>
        )}
      </div>
    </section>
  );
}
