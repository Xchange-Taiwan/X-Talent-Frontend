'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createEmptyMentorFeedbackPage,
  fetchMentorFeedback,
} from '@/services/profile/feedback';
import type { MentorFeedbackItem, MentorFeedbackPage } from '@/types/feedback';

export interface MentorFeedbackReader {
  items: MentorFeedbackItem[];
  totalRatingCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  ratingAverage: number | null;
  completedMeetingCount: number | null;
  isFallback: boolean;
  isLoading: boolean;
  hasError: boolean;
  setPage: (page: number) => void;
  retry: () => void;
}

export interface UseMentorFeedbackOptions {
  userId: number;
  enabled: boolean;
  initialFeedbackPage?: MentorFeedbackPage | null;
}

const DISABLED_FEEDBACK_PAGE: MentorFeedbackPage =
  createEmptyMentorFeedbackPage(1, true);

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function useMentorFeedback({
  userId,
  enabled,
  initialFeedbackPage,
}: UseMentorFeedbackOptions): MentorFeedbackReader {
  const cacheRef = useRef<Map<string, MentorFeedbackPage>>(new Map());
  const [page, setPageState] = useState(1);
  const [prevUserId, setPrevUserId] = useState(userId);
  const [reloadNonce, setReloadNonce] = useState(0);

  const initialKey = userId > 0 ? `${userId}:1` : null;
  if (initialFeedbackPage && initialKey && !cacheRef.current.has(initialKey)) {
    cacheRef.current.set(initialKey, initialFeedbackPage);
  }

  let activePage = page;
  const nextCacheKeyForReset = enabled && userId > 0 ? `${userId}:1` : null;
  const cachedFirstPageForReset = nextCacheKeyForReset
    ? cacheRef.current.get(nextCacheKeyForReset)
    : undefined;

  const cacheKey = enabled && userId > 0 ? `${userId}:${activePage}` : null;
  const cachedPage = cacheKey ? cacheRef.current.get(cacheKey) : undefined;
  const requestKey = cacheKey ? `${cacheKey}:${reloadNonce}` : null;

  const [currentData, setCurrentData] = useState<MentorFeedbackPage>(
    () => cachedPage ?? createEmptyMentorFeedbackPage(activePage, true)
  );
  const [failedRequestKey, setFailedRequestKey] = useState<string | null>(null);
  const [, setSettledTick] = useState(0);

  if (prevUserId !== userId) {
    setPrevUserId(userId);
    activePage = 1;
    setPageState(1);
    setCurrentData(
      cachedFirstPageForReset ?? createEmptyMentorFeedbackPage(1, true)
    );
    setFailedRequestKey(null);
  }

  const hasError = Boolean(
    requestKey && !cachedPage && failedRequestKey === requestKey
  );
  const isLoading = Boolean(requestKey && !cachedPage && !hasError);

  useEffect(() => {
    if (!cacheKey || !requestKey) {
      return;
    }

    const existing = cacheRef.current.get(cacheKey);
    if (existing) {
      setCurrentData(existing);
      return;
    }

    const controller = new AbortController();

    fetchMentorFeedback(userId, activePage, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        cacheRef.current.set(cacheKey, result);
        setCurrentData(result);
        setFailedRequestKey((prev) => (prev === requestKey ? null : prev));
        setSettledTick((prev) => prev + 1);
      })
      .catch((error) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setCurrentData((prev) =>
          prev.page === activePage && prev.items.length === 0
            ? prev
            : { ...prev, items: [], page: activePage }
        );
        setFailedRequestKey(requestKey);
      });

    return () => {
      controller.abort();
    };
  }, [cacheKey, requestKey, userId, activePage]);

  const setPage = useCallback((nextPage: number) => {
    if (!Number.isFinite(nextPage)) return;
    const clamped = Math.max(1, Math.floor(nextPage));
    setPageState((prev) => (prev === clamped ? prev : clamped));
  }, []);

  const retry = useCallback(() => {
    if (cacheKey) {
      cacheRef.current.delete(cacheKey);
    }
    setReloadNonce((prev) => prev + 1);
  }, [cacheKey]);

  const resolvedData = !cacheKey
    ? DISABLED_FEEDBACK_PAGE
    : (cachedPage ?? currentData);

  return useMemo(
    () => ({
      items: resolvedData.items,
      totalRatingCount: resolvedData.totalRatingCount,
      page: activePage,
      pageSize: resolvedData.pageSize,
      totalPages: resolvedData.totalPages,
      ratingAverage: resolvedData.ratingAverage,
      completedMeetingCount: resolvedData.completedMeetingCount,
      isFallback: resolvedData.isFallback,
      isLoading,
      hasError,
      setPage,
      retry,
    }),
    [resolvedData, activePage, isLoading, hasError, setPage, retry]
  );
}
