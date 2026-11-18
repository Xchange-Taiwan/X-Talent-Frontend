'use client';

import { Briefcase, Compass, MapPin } from 'lucide-react';

import {
  splitExperienceDisplay,
  toNonNegativeInt,
} from '@/lib/mentor/mentorStats';
import { cn } from '@/lib/utils';

export interface MenteeSummaryBarProps {
  yearsOfExperience?: string;
  location?: string;
  directionCount?: number;
  className?: string;
}

export function MenteeSummaryBar({
  yearsOfExperience,
  location,
  directionCount = 0,
  className,
}: MenteeSummaryBarProps) {
  const experienceParts = splitExperienceDisplay(yearsOfExperience);
  const locationLabel = location?.trim() || '—';
  const safeDirectionCount = toNonNegativeInt(directionCount);

  return (
    <section aria-label="學員摘要資訊" className={cn('mb-8 w-full', className)}>
      <div
        data-testid="mentee-summary-grid"
        className="border-background-border grid grid-cols-1 gap-y-4 border-y py-5 sm:grid-cols-3 sm:gap-y-0"
      >
        <div className="sm:pr-8">
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

        <div className="sm:border-background-border sm:border-l sm:px-8">
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

        <div className="sm:border-background-border sm:border-l sm:pl-8">
          <div className="text-text-tertiary mb-1.5 flex items-center gap-1.5 text-xs font-medium">
            <Compass
              className="text-text-tertiary size-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>探索方向</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-text-primary text-2xl font-bold tracking-tight">
              {safeDirectionCount}
            </span>
            <span className="text-text-secondary text-sm font-normal">
              個職位方向
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
