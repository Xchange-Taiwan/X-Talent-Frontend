'use client';

import { Bookmark } from 'lucide-react';
import type { MouseEvent } from 'react';

import {
  Tooltip,
  type TooltipAlign,
  type TooltipSide,
} from '@/components/ui/tooltip';
import {
  type FavoriteMentorAnalyticsFeature,
  useFavoriteMentor,
} from '@/hooks/favorites';
import { FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';
import type { MentorType } from '@/types/mentor';

export type MentorBookmarkButtonVariant = 'overlay' | 'outline';

export interface MentorBookmarkButtonProps {
  mentorId: number;
  mentorName: string;
  mentorSnapshot?: MentorType;
  analyticsFeature?: FavoriteMentorAnalyticsFeature;
  variant?: MentorBookmarkButtonVariant;
  tooltipSide?: TooltipSide;
  tooltipAlign?: TooltipAlign;
  wrapperClassName?: string;
  className?: string;
}

export function MentorBookmarkButton({
  mentorId,
  mentorName,
  mentorSnapshot,
  analyticsFeature = 'mentor_pool',
  variant = 'overlay',
  tooltipSide = 'bottom',
  tooltipAlign = 'end',
  wrapperClassName,
  className,
}: MentorBookmarkButtonProps) {
  const {
    isFavorited,
    isPending,
    isSelf,
    isIdentityUnresolved,
    handleToggleFavorite,
  } = useFavoriteMentor({
    mentorId,
    mentorSnapshot,
    analyticsFeature,
  });

  if (isSelf || isIdentityUnresolved) {
    return null;
  }

  const safeName = mentorName.trim() || '此導師';
  const actionLabel = isFavorited ? `取消收藏 ${safeName}` : `收藏 ${safeName}`;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void handleToggleFavorite();
  };

  return (
    <Tooltip
      content={actionLabel}
      side={tooltipSide}
      align={tooltipAlign}
      contentClassName="whitespace-nowrap"
      wrapperClassName={wrapperClassName}
    >
      <button
        type="button"
        data-testid="mentor-bookmark-button"
        aria-label={actionLabel}
        aria-pressed={isFavorited}
        aria-busy={isPending || undefined}
        onClick={handleClick}
        className={cn(
          'inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-colors',
          variant === 'overlay'
            ? 'border-background-border/60 bg-background-white/90 hover:bg-background-white border shadow-sm backdrop-blur-sm'
            : 'border-background-border bg-background-white hover:bg-background-hover border',
          FOCUS_RING_CLASSES,
          className
        )}
      >
        <Bookmark
          aria-hidden="true"
          className={cn(
            'size-5 transition-colors',
            isFavorited
              ? 'text-brand-500 fill-current'
              : 'text-text-secondary hover:text-text-primary'
          )}
        />
      </button>
    </Tooltip>
  );
}
