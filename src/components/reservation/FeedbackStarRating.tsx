'use client';

import { Star } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';
import {
  MAX_MEETING_RATING,
  MIN_MEETING_RATING,
} from '@/schemas/meetingFeedbackSchema';

export interface FeedbackStarRatingProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

const STAR_SCORES = Array.from(
  { length: MAX_MEETING_RATING - MIN_MEETING_RATING + 1 },
  (_, index) => MIN_MEETING_RATING + index
);

export function FeedbackStarRating({
  value,
  onChange,
  disabled = false,
  ariaLabel = '整體滿意度',
  className,
}: FeedbackStarRatingProps) {
  const [hoveredValue, setHoveredValue] = React.useState<number | null>(null);
  const buttonRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const displayValue = hoveredValue ?? value;

  const focusAndSelect = (nextScore: number) => {
    const clamped = Math.min(
      MAX_MEETING_RATING,
      Math.max(MIN_MEETING_RATING, nextScore)
    );
    onChange(clamped);
    buttonRefs.current[clamped - MIN_MEETING_RATING]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        focusAndSelect(value + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        focusAndSelect(value - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAndSelect(MIN_MEETING_RATING);
        break;
      case 'End':
        event.preventDefault();
        focusAndSelect(MAX_MEETING_RATING);
        break;
      default:
        break;
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('grid grid-cols-10 gap-1 sm:gap-1.5', className)}
    >
      {STAR_SCORES.map((score, idx) => {
        const isSelected = score === value;
        const isFilled = score <= displayValue;

        return (
          <button
            key={score}
            ref={(el) => {
              buttonRefs.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${score} 分`}
            data-rating-star={score}
            data-filled={isFilled ? 'true' : 'false'}
            tabIndex={isSelected ? 0 : -1}
            disabled={disabled}
            onMouseEnter={() => {
              if (!disabled) setHoveredValue(score);
            }}
            onMouseLeave={() => setHoveredValue(null)}
            onClick={() => {
              if (!disabled) onChange(score);
            }}
            onKeyDown={handleKeyDown}
            className="hover:bg-background-bottom focus-visible:ring-brand-700 flex h-9 w-full items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          >
            <Star
              strokeWidth={1.75}
              aria-hidden="true"
              className={cn(
                'size-5 transition-colors duration-150 sm:size-6',
                isFilled
                  ? 'fill-brand-700 text-brand-700'
                  : 'text-text-tertiary fill-transparent'
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
