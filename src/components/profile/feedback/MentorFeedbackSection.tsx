'use client';

import { ChevronLeft, ChevronRight, MessageCircle, Star } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { sortFeedbackItems } from '@/lib/feedback/mentorFeedbackReadModel';
import {
  formatFeedbackDate,
  formatRatingScoreValue,
  getAuthorInitial,
  toNonNegativeInt,
} from '@/lib/mentor/mentorStats';
import { cn } from '@/lib/utils';
import {
  DEFAULT_FEEDBACK_PAGE_SIZE,
  type MentorFeedbackItem,
} from '@/types/feedback';

export interface MentorFeedbackSectionProps {
  items: MentorFeedbackItem[];
  totalRatingCount: number;
  ratingAverage?: number | null;
  page?: number;
  pageSize?: number;
  isLoading?: boolean;
  error?: string | null;
  onPageChange?: (page: number) => void;
  onRetry?: () => void;
}

function buildPageNumbers(
  currentPage: number,
  totalPages: number
): Array<number | 'ellipsis-start' | 'ellipsis-end'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  const pages: Array<number | 'ellipsis-start' | 'ellipsis-end'> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    pages.push('ellipsis-start');
  }

  for (let p = start; p <= end; p += 1) {
    pages.push(p);
  }

  if (end < totalPages - 1) {
    pages.push('ellipsis-end');
  }

  pages.push(totalPages);
  return pages;
}

export function MentorFeedbackSkeleton() {
  return (
    <div
      data-testid="mentor-feedback-skeleton"
      className="animate-delayed-fade-in flex flex-col gap-6 pt-6"
    >
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-24" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      </div>

      <div className="divide-background-border divide-y">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="flex flex-col gap-3 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-8 rounded-full" />
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
  ratingAverage = null,
  page,
  pageSize = DEFAULT_FEEDBACK_PAGE_SIZE,
  isLoading = false,
  error = null,
  onPageChange,
  onRetry,
}: MentorFeedbackSectionProps) {
  const [internalPage, setInternalPage] = useState(1);

  const resolvedPage = page ?? internalPage;
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const safeTotalCount = Math.max(
    toNonNegativeInt(totalRatingCount),
    items.length
  );
  const totalPages = Math.ceil(safeTotalCount / safePageSize);
  const formattedAverage = formatRatingScoreValue(ratingAverage);

  const displayedItems = useMemo(() => {
    if (onPageChange) {
      return items;
    }
    const sorted = sortFeedbackItems(items);
    if (sorted.length > safePageSize) {
      const start = (resolvedPage - 1) * safePageSize;
      return sorted.slice(start, start + safePageSize);
    }
    return sorted;
  }, [items, onPageChange, resolvedPage, safePageSize]);

  const handlePageChange = (nextPage: number) => {
    const clamped = Math.min(Math.max(1, nextPage), Math.max(1, totalPages));
    if (clamped === resolvedPage) return;
    if (onPageChange) {
      onPageChange(clamped);
    } else {
      setInternalPage(clamped);
    }
  };

  if (isLoading && items.length === 0) {
    return <MentorFeedbackSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-text-secondary text-sm font-medium">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            重新載入
          </Button>
        )}
      </div>
    );
  }

  if (safeTotalCount === 0 && displayedItems.length === 0) {
    return (
      <div
        data-testid="mentor-feedback-empty"
        className="flex flex-col items-center justify-center py-20 text-center"
      >
        <MessageCircle
          className="text-text-tertiary mb-4 size-9 stroke-[1.75]"
          aria-hidden="true"
        />
        <p className="text-text-primary mb-2 text-base font-bold">
          目前還沒有評價
        </p>
        <p className="text-text-tertiary text-sm">
          完成會談後，學員的評價會顯示在這裡。
        </p>
      </div>
    );
  }

  const pageTokens = buildPageNumbers(resolvedPage, totalPages);

  return (
    <div data-testid="mentor-feedback-section" className="pt-6">
      <div className="flex items-center gap-4 pb-4">
        {formattedAverage && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-text-primary text-4xl font-bold tracking-tight">
              {formattedAverage}
            </span>
            <span className="text-text-tertiary text-sm font-normal">/ 10</span>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Star
            className="fill-brand-700 text-brand-700 size-4"
            aria-hidden="true"
          />
          <span className="text-text-tertiary text-xs font-normal">
            {safeTotalCount} 則會談評價
          </span>
        </div>
      </div>

      {displayedItems.length === 0 ? (
        <div
          data-testid="mentor-feedback-list-empty"
          className="border-background-border flex flex-col items-center justify-center gap-3 border-t py-14 text-center"
        >
          <MessageCircle
            className="text-text-tertiary size-8 stroke-[1.75]"
            aria-hidden="true"
          />
          <p className="text-text-secondary text-sm font-medium">
            目前暫無法顯示評價內容，請稍後再試。
          </p>
          {onRetry && (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              重新載入
            </Button>
          )}
        </div>
      ) : (
        <>
          <ul
            aria-label="會談評價列表"
            className={cn(
              'divide-background-border border-background-border divide-y border-b',
              isLoading && 'opacity-60 transition-opacity'
            )}
          >
            {displayedItems.map((item) => {
              const initial = getAuthorInitial(item.authorName);
              const dateText = formatFeedbackDate(item.createdAt);

              return (
                <li key={item.id} className="flex flex-col gap-3 py-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="bg-brand-50 text-brand-700 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                      >
                        {initial}
                      </span>
                      <span className="text-text-primary truncate text-sm font-semibold">
                        {item.authorName}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        aria-label={`評分 ${item.rating} / 10`}
                        className="text-brand-700 inline-flex items-center gap-1 text-xs font-medium tabular-nums"
                      >
                        <Star
                          className="text-brand-700 size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{item.rating} / 10</span>
                      </span>
                      {dateText && (
                        <time className="text-text-tertiary text-xs tabular-nums">
                          {dateText}
                        </time>
                      )}
                    </div>
                  </div>

                  {item.content && (
                    <p className="text-text-primary text-sm leading-relaxed break-words whitespace-pre-line">
                      {item.content}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <nav
              aria-label="評價分頁"
              className="mt-8 flex flex-wrap items-center justify-center gap-1.5"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="上一頁"
                disabled={isLoading || resolvedPage <= 1}
                onClick={() => handlePageChange(resolvedPage - 1)}
                className="h-9 gap-1 px-2.5 text-xs"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                <span>上一頁</span>
              </Button>

              {pageTokens.map((token) =>
                typeof token === 'number' ? (
                  <Button
                    key={token}
                    type="button"
                    variant={token === resolvedPage ? 'default' : 'outline'}
                    size="sm"
                    aria-label={`第 ${token} 頁`}
                    aria-current={token === resolvedPage ? 'page' : undefined}
                    disabled={isLoading}
                    onClick={() => handlePageChange(token)}
                    className={cn(
                      'h-9 min-w-9 px-2.5 text-xs tabular-nums',
                      token === resolvedPage &&
                        'bg-brand-700 hover:bg-brand-700/90 text-text-white border-transparent'
                    )}
                  >
                    {token}
                  </Button>
                ) : (
                  <span
                    key={token}
                    aria-hidden="true"
                    className="text-text-tertiary px-1.5 text-xs"
                  >
                    …
                  </span>
                )
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="下一頁"
                disabled={isLoading || resolvedPage >= totalPages}
                onClick={() => handlePageChange(resolvedPage + 1)}
                className="h-9 gap-1 px-2.5 text-xs"
              >
                <span>下一頁</span>
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
