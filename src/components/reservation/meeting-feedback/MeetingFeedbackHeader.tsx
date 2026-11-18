'use client';

import { X } from 'lucide-react';
import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip } from '@/components/ui/tooltip';
import { getAvatarThumbUrl } from '@/lib/avatar/getAvatarThumbUrl';
import { getInitials } from '@/lib/avatar/getInitials';
import { cn } from '@/lib/utils';
import type { Reservation } from '@/types/reservation';

export interface MeetingFeedbackHeaderProps {
  activeReservation: Reservation;
  queueItems: Reservation[];
  queueIndex: number;
  isQueueMode: boolean;
  isMentor: boolean;
  isSubmitting: boolean;
  isTransitioningCard: boolean;
  tooltipDismissSignal: number;
  onSkipTooltipOpenChange: (open: boolean) => void;
  onCloseOrSkipClick: () => void;
}

export function MeetingFeedbackHeader({
  activeReservation,
  queueItems,
  queueIndex,
  isQueueMode,
  isMentor,
  isSubmitting,
  isTransitioningCard,
  tooltipDismissSignal,
  onSkipTooltipOpenChange,
  onCloseOrSkipClick,
}: MeetingFeedbackHeaderProps) {
  return (
    <div className="relative z-20 shrink-0 px-5 pt-5 sm:px-6 sm:pt-5">
      {isQueueMode ? (
        <div className="mb-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-text-primary text-base font-semibold">
                會談回饋
              </span>
              <span
                data-testid="feedback-queue-counter"
                className="text-text-tertiary text-xs tabular-nums"
              >
                第 {queueIndex + 1}／{queueItems.length} 場
              </span>
            </div>

            <Tooltip
              content="略過這場，下次登入再提醒；也可到歷史紀錄填寫。"
              side="bottom"
              align="end"
              dismissSignal={tooltipDismissSignal}
              onOpenChange={onSkipTooltipOpenChange}
              testId="feedback-skip-tooltip"
              contentClassName="w-60"
            >
              <button
                type="button"
                aria-label={`略過 ${activeReservation.name} 這場回饋`}
                disabled={isSubmitting || isTransitioningCard}
                onClick={onCloseOrSkipClick}
                className="text-text-secondary hover:bg-background-bottom hover:text-text-primary focus-visible:ring-brand-500 inline-flex size-7 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </Tooltip>
          </div>

          <div
            role="progressbar"
            aria-label="會談回饋進度"
            aria-valuemin={1}
            aria-valuemax={queueItems.length}
            aria-valuenow={queueIndex + 1}
            data-testid="feedback-queue-progressbar"
            className="mt-2.5 flex gap-1.5"
          >
            {queueItems.map((item, idx) => {
              const segmentState =
                idx < queueIndex
                  ? 'completed'
                  : idx === queueIndex
                    ? 'current'
                    : 'upcoming';

              return (
                <span
                  key={item.id}
                  data-state={segmentState}
                  data-active={idx <= queueIndex ? 'true' : 'false'}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors duration-300',
                    segmentState === 'current'
                      ? 'bg-brand-700'
                      : segmentState === 'completed'
                        ? 'bg-brand-200'
                        : 'bg-background-border'
                  )}
                />
              );
            })}
          </div>
        </div>
      ) : isMentor ? (
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <span
            data-testid="feedback-dialog-title"
            className="text-text-primary text-base font-semibold"
          >
            確認會談
          </span>
          <button
            type="button"
            aria-label="關閉回饋視窗"
            disabled={isSubmitting}
            onClick={onCloseOrSkipClick}
            className="text-text-secondary hover:bg-background-bottom hover:text-text-primary focus-visible:ring-brand-500 inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div
        data-testid="feedback-mentor-header"
        className="flex items-center justify-between gap-3"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            data-clarity-mask="true"
            className="border-avatar-border/50 size-10 shrink-0 border"
          >
            <AvatarImage
              src={
                activeReservation.avatar?.trim()
                  ? getAvatarThumbUrl(activeReservation.avatar.trim())
                  : undefined
              }
              alt={activeReservation.name}
            />
            <AvatarFallback className="text-text-primary text-xs font-medium">
              {getInitials(activeReservation.name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <p
              data-clarity-mask="true"
              className="text-text-primary truncate text-sm font-semibold"
            >
              {activeReservation.name}
            </p>
            <p className="text-text-secondary truncate text-xs tabular-nums">
              {activeReservation.date} · {activeReservation.time}
            </p>
          </div>
        </div>

        {!isQueueMode && !isMentor ? (
          <button
            type="button"
            aria-label="關閉回饋視窗"
            disabled={isSubmitting}
            onClick={onCloseOrSkipClick}
            className="text-text-secondary hover:bg-background-bottom hover:text-text-primary focus-visible:ring-brand-500 inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="bg-background-border mt-3.5 h-px w-full" />
    </div>
  );
}
