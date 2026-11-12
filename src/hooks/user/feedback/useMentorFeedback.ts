'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { toFeedbackTimestampMs } from '@/lib/mentor/mentorStats';
import {
  fetchMentorFeedback,
  subscribeMentorFeedbackInvalidation,
} from '@/services/profile/feedback';
import {
  DEFAULT_FEEDBACK_PAGE_SIZE,
  type MentorFeedbackItem,
  type MentorFeedbackPage,
} from '@/types/feedback';

export interface UseMentorFeedbackOptions {
  mentorId: number;
  enabled?: boolean;
  pageSize?: number;
}

export interface MentorFeedbackState {
  items: MentorFeedbackItem[];
  totalRatingCount: number;
  ratingAverage: number | null;
  completedMeetingCount: number | null;
  page: number;
  pageSize: number;
  isLoading: boolean;
  hasLoaded: boolean;
  isFallbackEmpty: boolean;
  error: string | null;
  setPage: (page: number) => void;
  reload: () => void;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function sortFeedbackItems(
  items: ReadonlyArray<MentorFeedbackItem>
): MentorFeedbackItem[] {
  if (items.length <= 1) {
    return [...items];
  }

  const copy = [...items];
  const allHaveValidDates = copy.every(
    (item) => toFeedbackTimestampMs(item.createdAt) > 0
  );
  if (allHaveValidDates) {
    copy.sort(
      (a, b) =>
        toFeedbackTimestampMs(b.createdAt) - toFeedbackTimestampMs(a.createdAt)
    );
  }
  return copy;
}

export function useMentorFeedback({
  mentorId,
  enabled = true,
  pageSize = DEFAULT_FEEDBACK_PAGE_SIZE,
}: UseMentorFeedbackOptions): MentorFeedbackState {
  const [page, setPageState] = useState(1);
  const [data, setData] = useState<MentorFeedbackPage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    setPageState(1);
    setData(null);
    setHasLoaded(false);
    setError(null);
  }, [mentorId]);

  const setPage = useCallback((nextPage: number) => {
    setPageState(Math.max(1, Math.floor(nextPage)));
  }, []);

  const reload = useCallback(() => {
    setReloadTick((prev) => prev + 1);
  }, []);

  const canFetch = enabled && Number.isFinite(mentorId) && mentorId > 0;

  useEffect(() => {
    if (!canFetch) return;
    return subscribeMentorFeedbackInvalidation((invalidatedMentorId) => {
      if (
        invalidatedMentorId === undefined ||
        invalidatedMentorId === mentorId
      ) {
        setReloadTick((prev) => prev + 1);
      }
    });
  }, [canFetch, mentorId]);

  useEffect(() => {
    if (!canFetch) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetchMentorFeedback({
      mentorId,
      page,
      pageSize,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setHasLoaded(true);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) {
          return;
        }
        setError('載入評價時發生錯誤，請稍後再試。');
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [canFetch, mentorId, page, pageSize, reloadTick]);

  const sortedItems = useMemo(
    () => sortFeedbackItems(data?.items ?? []),
    [data?.items]
  );

  const effectiveIsLoading = isLoading || (canFetch && !hasLoaded && !error);

  return {
    items: sortedItems,
    totalRatingCount: data?.totalRatingCount ?? 0,
    ratingAverage: data?.ratingAverage ?? null,
    completedMeetingCount: data?.completedMeetingCount ?? null,
    page: data?.page ?? page,
    pageSize: data?.pageSize ?? pageSize,
    isLoading: effectiveIsLoading,
    hasLoaded,
    isFallbackEmpty: Boolean(data?.isFallbackEmpty),
    error,
    setPage,
    reload,
  };
}
