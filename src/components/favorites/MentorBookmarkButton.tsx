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
  type FavoriteMentorAnalyticsLocation,
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
  analyticsLocation?: FavoriteMentorAnalyticsLocation;
  variant?: MentorBookmarkButtonVariant;
  tooltipSide?: TooltipSide;
  tooltipAlign?: TooltipAlign;
  wrapperClassName?: string;
  className?: string;
}

function getVariantClasses(
  variant: MentorBookmarkButtonVariant,
  isFavorited: boolean
): string {
  if (variant === 'overlay') {
    return isFavorited
      ? 'border-brand-500/30 bg-brand-50/95 hover:bg-brand-100 border shadow-sm backdrop-blur-sm'
      : 'border-background-border/60 bg-background-white/90 hover:bg-background-white border shadow-sm backdrop-blur-sm';
  }

  return isFavorited
    ? 'border-brand-100 bg-brand-50 hover:bg-brand-100 border'
    : 'border-background-border bg-background-white hover:bg-background-hover border';
}

export function MentorBookmarkButton({
  mentorId,
  mentorName,
  mentorSnapshot,
  analyticsFeature = 'mentor_pool',
  analyticsLocation,
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
    analyticsLocation,
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
          'group inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-colors',
          getVariantClasses(variant, isFavorited),
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
              : 'text-text-secondary group-hover:text-text-primary'
          )}
        />
      </button>
    </Tooltip>
  );
}
