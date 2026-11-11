'use client';

import { ChevronLeft, ChevronRight, MessageCircle, Star } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  formatMentorScoreNumber,
  formatReviewItemScore,
} from '@/lib/mentor/mentorStats';
import { FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';
import type { MentorFeedbackItem } from '@/types/feedback';

export const EMPTY_MENTOR_REVIEWS_TITLE = '目前還沒有評價';
export const EMPTY_MENTOR_REVIEWS_SUBTITLE =
  '完成會談後，學員的評價會顯示在這裡。';

export interface MentorFeedbackSectionProps {
  items: MentorFeedbackItem[];
  totalRatingCount: number;
  ratingAverage: number | null;
  page: number;
  totalPages: number;
  isLoading: boolean;
  hasError?: boolean;
  onPageChange: (page: number) => void;
  onRetry?: () => void;
}

type PaginationToken = number | 'ellipsis-start' | 'ellipsis-end';

export function buildPaginationTokens(
  currentPage: number,
  totalPages: number
): PaginationToken[] {
  if (!Number.isFinite(totalPages) || totalPages <= 1) return [];
  const safeTotalPages = Math.floor(totalPages);
  if (safeTotalPages <= 7) {
    return Array.from({ length: safeTotalPages }, (_, idx) => idx + 1);
  }

  const safeCurrentPage = Number.isFinite(currentPage)
    ? Math.min(safeTotalPages, Math.max(1, Math.floor(currentPage)))
    : 1;

  const tokens: PaginationToken[] = [1];
  const windowStart = Math.max(2, safeCurrentPage - 1);
  const windowEnd = Math.min(safeTotalPages - 1, safeCurrentPage + 1);

  if (windowStart > 2) {
    tokens.push('ellipsis-start');
  }
  for (let p = windowStart; p <= windowEnd; p += 1) {
    tokens.push(p);
  }
  if (windowEnd < safeTotalPages - 1) {
    tokens.push('ellipsis-end');
  }
  tokens.push(safeTotalPages);

  return tokens;
}

function MentorFeedbackSkeleton() {
  return (
    <div aria-busy="true" data-testid="mentor-feedback-skeleton">
      <div className="flex items-center gap-4 py-6">
        <Skeleton className="h-10 w-24" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="divide-background-border divide-y">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="flex flex-col gap-3 py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MentorFeedbackSection({
  items,
  totalRatingCount,
  ratingAverage,
  page,
  totalPages,
  isLoading,
  hasError = false,
  onPageChange,
  onRetry,
}: MentorFeedbackSectionProps) {
  if (isLoading && items.length === 0) {
    return <MentorFeedbackSkeleton />;
  }

  if (hasError && items.length === 0 && totalPages <= 1) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center sm:py-20">
        <p className="text-text-secondary text-sm font-medium">
          無法載入評價資料，請稍後再試
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            重新載入
          </Button>
        )}
      </div>
    );
  }

  const effectiveCount = Math.max(totalRatingCount, items.length);

  if (effectiveCount === 0 && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-14 text-center sm:py-20">
        <MessageCircle
          className="text-text-tertiary mb-3 h-8 w-8 stroke-[1.75]"
          aria-hidden="true"
        />
        <p className="text-text-primary text-base font-semibold">
          {EMPTY_MENTOR_REVIEWS_TITLE}
        </p>
        <p className="text-text-tertiary mt-1.5 text-sm">
          {EMPTY_MENTOR_REVIEWS_SUBTITLE}
        </p>
      </div>
    );
  }

  const scoreText = formatMentorScoreNumber(ratingAverage);
  const paginationTokens = buildPaginationTokens(page, totalPages);

  return (
    <div>
      <div className="flex items-center gap-4 py-6">
        {scoreText && (
          <div className="flex items-baseline gap-1">
            <span className="text-text-primary text-3xl font-bold tracking-tight sm:text-4xl">
              {scoreText}
            </span>
            <span className="text-text-tertiary text-sm sm:text-base">
              / 10
            </span>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Star
            className="fill-brand-600 text-brand-600 h-4 w-4"
            aria-hidden="true"
          />
          <p className="text-text-tertiary text-xs sm:text-sm">
            {effectiveCount} 則會談評價
          </p>
        </div>
      </div>

      {items.length > 0 ? (
        <ul
          aria-label="學員評價列表"
          aria-busy={isLoading}
          className={cn(
            'divide-background-border border-background-border divide-y border-b transition-opacity',
            isLoading && 'opacity-60'
          )}
        >
          {items.map((item) => (
            <li key={item.id} className="py-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="bg-brand-50 text-brand-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  >
                    {item.authorInitial}
                  </span>
                  <span className="text-text-primary truncate text-sm font-semibold">
                    {item.authorName}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {item.rating > 0 && (
                    <span className="text-brand-700 inline-flex items-center gap-1 text-xs font-medium sm:text-sm">
                      <Star
                        className="text-brand-600 h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{formatReviewItemScore(item.rating)} / 10</span>
                    </span>
                  )}
                  {item.formattedDate && (
                    <time
                      dateTime={item.createdAt}
                      className="text-text-tertiary text-xs tabular-nums sm:text-sm"
                    >
                      {item.formattedDate}
                    </time>
                  )}
                </div>
              </div>

              {item.content && (
                <p className="text-text-primary mt-3 text-sm leading-relaxed break-words whitespace-pre-line">
                  {item.content}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : hasError ? (
        <div className="border-background-border flex flex-col items-center justify-center gap-3 border-b px-4 py-12 text-center">
          <p className="text-text-secondary text-sm font-medium">
            無法載入評價資料，請稍後再試
          </p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              重新載入
            </Button>
          )}
        </div>
      ) : null}

      {totalPages > 1 && (
        <nav
          aria-label="評價分頁"
          className="mt-8 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2"
        >
          <button
            type="button"
            aria-label="上一頁"
            disabled={page <= 1 || isLoading}
            onClick={() => onPageChange(page - 1)}
            className={cn(
              'border-background-border text-text-secondary hover:bg-background-bottom inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 sm:px-3 sm:text-sm',
              FOCUS_RING_CLASSES
            )}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span>上一頁</span>
          </button>

          {paginationTokens.map((token) => {
            if (typeof token !== 'number') {
              return (
                <span
                  key={token}
                  aria-hidden="true"
                  className="text-text-tertiary px-1 text-sm select-none"
                >
                  …
                </span>
              );
            }

            const isActive = token === page;
            return (
              <button
                key={token}
                type="button"
                aria-label={`第 ${token} 頁`}
                aria-current={isActive ? 'page' : undefined}
                disabled={isLoading}
                onClick={() => onPageChange(token)}
                className={cn(
                  'inline-flex h-9 min-w-[36px] items-center justify-center rounded-lg border px-2.5 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 sm:text-sm',
                  isActive
                    ? 'border-brand-600 bg-brand-50 text-brand-700 font-semibold'
                    : 'border-background-border text-text-secondary hover:bg-background-bottom',
                  FOCUS_RING_CLASSES
                )}
              >
                {token}
              </button>
            );
          })}

          <button
            type="button"
            aria-label="下一頁"
            disabled={page >= totalPages || isLoading}
            onClick={() => onPageChange(page + 1)}
            className={cn(
              'border-background-border text-text-secondary hover:bg-background-bottom inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 sm:px-3 sm:text-sm',
              FOCUS_RING_CLASSES
            )}
          >
            <span>下一頁</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
}
