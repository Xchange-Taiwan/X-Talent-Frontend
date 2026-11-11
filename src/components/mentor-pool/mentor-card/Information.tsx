'use client';

import { useRef, useState } from 'react';

import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { computeOverflowFit } from '@/lib/overflowFit';

import { Tag } from './Tag';

interface InformationProps {
  name: string;
  job_title: string;
  company: string;
  about: string;
  haveTopicLabels: string[];
  ratingAverage?: number | null;
  completedMeetingCount?: number | null;
}

const TAG_GAP_PX = 8;
const EXTRA_BADGE_RESERVE_PX = 52;

export function formatMentorRating(
  ratingAverage?: number | null
): string | null {
  if (
    typeof ratingAverage !== 'number' ||
    !Number.isFinite(ratingAverage) ||
    ratingAverage <= 0
  ) {
    return null;
  }
  const rounded = Math.round(ratingAverage * 10) / 10;
  return `${rounded.toFixed(1)} / 10`;
}

export function formatCompletedMeetings(
  completedMeetingCount?: number | null
): string | null {
  if (
    typeof completedMeetingCount !== 'number' ||
    !Number.isFinite(completedMeetingCount) ||
    completedMeetingCount <= 0
  ) {
    return null;
  }
  const count = Math.floor(completedMeetingCount);
  if (count <= 0) {
    return null;
  }
  return `已完成 ${count} 場 1-on-1`;
}

export const Information = ({
  name,
  job_title,
  company,
  about,
  haveTopicLabels = [],
  ratingAverage = null,
  completedMeetingCount = null,
}: InformationProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const widthsRef = useRef<number[]>([]);
  const [visibleTagsCount, setVisibleTagsCount] = useState(
    haveTopicLabels.length
  );

  useIsomorphicLayoutEffect(() => {
    if (!measureRef.current || !containerRef.current) return;

    const widths = Array.from(measureRef.current.children).map(
      (child) => (child as HTMLElement).getBoundingClientRect().width
    );
    widthsRef.current = widths;

    const computeVisible = (width: number) => {
      const { visibleCount } = computeOverflowFit({
        itemWidths: widthsRef.current,
        containerWidth: width,
        gapPx: TAG_GAP_PX,
        reservePx: EXTRA_BADGE_RESERVE_PX,
        defaultVisibleCount: haveTopicLabels.length,
      });
      setVisibleTagsCount(visibleCount);
    };

    computeVisible(containerRef.current.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      computeVisible(entry.contentRect.width);
    });
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [haveTopicLabels]);

  const visibleOffers = haveTopicLabels.slice(0, visibleTagsCount);
  const extraOffersCount = haveTopicLabels.length - visibleTagsCount;
  const formattedRating = formatMentorRating(ratingAverage);
  const completedMeetingsLabel = formatCompletedMeetings(completedMeetingCount);

  return (
    <div className="flex h-full flex-1 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="min-w-0 truncate text-base font-bold tracking-[0.5px]">
            {name}
          </h3>
          {formattedRating && (
            <span
              aria-label={`平均評分 ${formattedRating}`}
              className="text-text-primary shrink-0 text-sm font-bold tracking-[0.5px] whitespace-nowrap xl:text-base"
            >
              {formattedRating}
            </span>
          )}
        </div>
        {(job_title || company) && (
          <div className="flex flex-wrap gap-x-[6px] text-sm font-normal tracking-wide">
            {job_title}
            {job_title && company && (
              <span className="text-text-tertiary">at</span>
            )}
            {company}
          </div>
        )}
        {completedMeetingsLabel && (
          <p className="text-text-primary text-sm font-normal tracking-wide">
            {completedMeetingsLabel}
          </p>
        )}
      </div>
      <p className="text-text-tertiary line-clamp-2 min-h-[40px] text-sm font-normal tracking-wide">
        {about}
      </p>
      <div className="relative mt-auto">
        <div
          ref={measureRef}
          aria-hidden
          data-testid="measure-container"
          className="pointer-events-none invisible absolute top-0 left-0 flex flex-wrap gap-2"
        >
          {haveTopicLabels.map((offer) => (
            <Tag label={offer} key={`measure-${offer}`} />
          ))}
        </div>
        <div
          ref={containerRef}
          data-testid="display-container"
          className="flex flex-wrap gap-2"
        >
          {visibleOffers.map((offer) => (
            <Tag label={offer} key={offer} />
          ))}
          {extraOffersCount > 0 && (
            <Tag label={`+${extraOffersCount}`} key="extra" />
          )}
        </div>
      </div>
    </div>
  );
};
