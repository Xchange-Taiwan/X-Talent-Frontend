'use client';

import { Briefcase, MapPin, Star, Users } from 'lucide-react';
import type { ReactNode } from 'react';

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
  className?: string;
}

interface SummaryCell {
  key: 'rating' | 'meetings' | 'experience' | 'location';
  label: string;
  icon: ReactNode;
  content: ReactNode;
}

function getGridClassName(total: number): string {
  if (total >= 4) {
    return 'grid-cols-2 gap-y-5 md:grid-cols-4 md:gap-y-0';
  }
  if (total === 3) {
    return 'grid-cols-1 gap-y-4 sm:grid-cols-3 sm:gap-y-0';
  }
  return 'grid-cols-2';
}

function getCellClassName(index: number, total: number): string {
  if (total >= 4) {
    if (index === 0) return 'pr-4 md:pr-8';
    if (index === 1) return 'border-background-border border-l pl-4 md:px-8';
    if (index === 2) {
      return 'md:border-background-border pr-4 md:border-l md:px-8';
    }
    return 'border-background-border border-l pl-4 md:pl-8';
  }

  if (total === 3) {
    if (index === 0) return 'sm:pr-8';
    if (index === 1) {
      return 'sm:border-background-border sm:border-l sm:px-8';
    }
    return 'sm:border-background-border sm:border-l sm:pl-8';
  }

  if (index === 0) {
    return 'pr-4 sm:pr-8';
  }
  return 'border-background-border border-l pl-4 sm:pl-8';
}

export function MentorSummaryBar({
  ratingAverage = null,
  ratingCount = 0,
  completedMeetingCount = 0,
  yearsOfExperience,
  location,
  className,
}: MentorSummaryBarProps) {
  const safeRatingCount = toNonNegativeInt(ratingCount);
  const formattedScore =
    safeRatingCount > 0 ? formatRatingScoreValue(ratingAverage) : null;
  const hasRating = formattedScore !== null;
  const safeCompletedCount = toNonNegativeInt(completedMeetingCount);
  const hasCompletedMeetings = safeCompletedCount > 0;
  const experienceParts = splitExperienceDisplay(yearsOfExperience);
  const locationLabel = location?.trim() || '—';

  const cells: SummaryCell[] = [];

  if (hasRating) {
    cells.push({
      key: 'rating',
      label: '評分',
      icon: (
        <Star
          className="fill-brand-700 text-brand-700 size-3.5 shrink-0"
          aria-hidden="true"
        />
      ),
      content: (
        <div className="flex items-baseline gap-1">
          <span className="text-text-primary text-2xl font-bold tracking-tight">
            {formattedScore}
          </span>
          <span className="text-text-tertiary text-sm font-normal">/ 10</span>
        </div>
      ),
    });
  }

  if (hasCompletedMeetings) {
    cells.push({
      key: 'meetings',
      label: '已完成 1-on-1',
      icon: (
        <Users
          className="text-text-tertiary size-3.5 shrink-0"
          aria-hidden="true"
        />
      ),
      content: (
        <div className="flex items-baseline gap-1">
          <span className="text-text-primary text-2xl font-bold tracking-tight">
            {safeCompletedCount}
          </span>
          <span className="text-text-secondary text-sm font-normal">場</span>
        </div>
      ),
    });
  }

  cells.push({
    key: 'experience',
    label: '經驗',
    icon: (
      <Briefcase
        className="text-text-tertiary size-3.5 shrink-0"
        aria-hidden="true"
      />
    ),
    content: (
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
    ),
  });

  cells.push({
    key: 'location',
    label: '地點',
    icon: (
      <MapPin
        className="text-text-tertiary size-3.5 shrink-0"
        aria-hidden="true"
      />
    ),
    content: (
      <div className="flex items-baseline">
        <span className="text-text-primary text-2xl font-bold tracking-tight">
          {locationLabel}
        </span>
      </div>
    ),
  });

  return (
    <section aria-label="導師摘要資訊" className={cn('mb-8 w-full', className)}>
      <div
        data-testid="mentor-summary-grid"
        className={cn(
          'border-background-border grid border-y py-5',
          getGridClassName(cells.length)
        )}
      >
        {cells.map((cell, idx) => (
          <div key={cell.key} className={getCellClassName(idx, cells.length)}>
            <div className="text-text-tertiary mb-1.5 flex items-center gap-1.5 text-xs font-medium">
              {cell.icon}
              <span>{cell.label}</span>
            </div>
            {cell.content}
          </div>
        ))}
      </div>
    </section>
  );
}
