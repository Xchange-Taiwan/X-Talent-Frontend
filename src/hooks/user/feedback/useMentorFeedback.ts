'use client';

import { useCallback, useMemo, useState } from 'react';

import { useAsyncRead } from '@/hooks/useAsyncRead';
import {
  type MentorFeedbackReadKey,
  mentorFeedbackReadModel,
} from '@/lib/feedback/mentorFeedbackReadModel';
import { fetchMentorFeedback } from '@/services/profile/feedback';
import {
  DEFAULT_FEEDBACK_PAGE_SIZE,
  type MentorFeedbackItem,
} from '@/types/feedback';

export interface UseMentorFeedbackOptions {
  mentorId: number;
  enabled?: boolean;
  pageSize?: number;
}

export interface MentorFeedbackState {
  items: MentorFeedbackItem[];
  totalRatingCount: number | null;
  ratingAverage: number | null;
  completedMeetingCount: number | null;
  page: number;
  pageSize: number;
  isLoading: boolean;
  hasLoaded: boolean;
  isFallbackEmpty: boolean;
  error: string | null;
  setPage: (nextPage: number) => void;
  reload: () => void;
}

export type UseMentorFeedbackResult = MentorFeedbackState;

const EMPTY_FEEDBACK_ITEMS: MentorFeedbackItem[] = [];
const MENTOR_FEEDBACK_LOAD_ERROR = '載入評價時發生錯誤，請稍後再試。';

export function useMentorFeedback({
  mentorId,
  enabled = true,
  pageSize = DEFAULT_FEEDBACK_PAGE_SIZE,
}: UseMentorFeedbackOptions): UseMentorFeedbackResult {
  const [page, setPageState] = useState(1);
  const [prevMentorId, setPrevMentorId] = useState(mentorId);

  let effectivePage = page;
  if (prevMentorId !== mentorId) {
    setPrevMentorId(mentorId);
    effectivePage = 1;
    if (page !== 1) {
      setPageState(1);
    }
  }

  const canFetch = Boolean(
    enabled && Number.isFinite(mentorId) && mentorId > 0
  );

  const activeKey = useMemo<MentorFeedbackReadKey | null>(
    () => (canFetch ? { mentorId, page: effectivePage, pageSize } : null),
    [canFetch, mentorId, effectivePage, pageSize]
  );

  const fetcher = useCallback(
    (signal: AbortSignal) =>
      fetchMentorFeedback({
        mentorId,
        page: effectivePage,
        pageSize,
        signal,
      }),
    [mentorId, effectivePage, pageSize]
  );

  const {
    data,
    isLoading,
    error: rawError,
    refetch,
  } = useAsyncRead(mentorFeedbackReadModel, activeKey, fetcher);

  const summarySource =
    data ??
    (canFetch
      ? mentorFeedbackReadModel.peek({ mentorId, page: 1, pageSize })
      : undefined);

  const setPage = useCallback((nextPage: number) => {
    setPageState(Math.max(1, Math.floor(nextPage)));
  }, []);

  return {
    items: data?.items ?? EMPTY_FEEDBACK_ITEMS,
    totalRatingCount: summarySource?.totalRatingCount ?? null,
    ratingAverage: summarySource?.ratingAverage ?? null,
    completedMeetingCount: summarySource?.completedMeetingCount ?? null,
    page: data?.page ?? effectivePage,
    pageSize: data?.pageSize ?? pageSize,
    isLoading: canFetch && isLoading,
    hasLoaded: canFetch && summarySource !== undefined,
    isFallbackEmpty: Boolean(summarySource?.isFallbackEmpty),
    error: canFetch && rawError !== null ? MENTOR_FEEDBACK_LOAD_ERROR : null,
    setPage,
    reload: refetch,
  };
}
