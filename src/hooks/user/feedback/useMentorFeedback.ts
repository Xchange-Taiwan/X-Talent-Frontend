'use client';

import { useCallback, useMemo, useState } from 'react';

import { useAsyncRead } from '@/hooks/useAsyncRead';
import { isFeedbackEnabled } from '@/lib/featureFlags';
import {
  type MentorFeedbackReadKey,
  mentorFeedbackReadModel,
} from '@/lib/feedback/mentorFeedbackReadModel';
import { resolveProfileUserId } from '@/lib/profile/userId';
import { fetchMentorFeedback } from '@/services/profile/feedback';
import {
  DEFAULT_FEEDBACK_PAGE_SIZE,
  type MentorFeedbackItem,
} from '@/types/feedback';

export interface UseMentorFeedbackOptions {
  mentorId: number | string;
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

  const feedbackEnabled = isFeedbackEnabled();
  const resolvedMentorId = resolveProfileUserId(mentorId);
  const canFetch = Boolean(
    feedbackEnabled && enabled && resolvedMentorId !== null
  );

  const activeKey = useMemo<MentorFeedbackReadKey | null>(
    () =>
      canFetch && resolvedMentorId !== null
        ? { mentorId: resolvedMentorId, page: effectivePage, pageSize }
        : null,
    [canFetch, resolvedMentorId, effectivePage, pageSize]
  );

  const fetcher = useCallback(
    (signal: AbortSignal) =>
      fetchMentorFeedback({
        mentorId: resolvedMentorId ?? mentorId,
        page: effectivePage,
        pageSize,
        signal,
      }),
    [resolvedMentorId, mentorId, effectivePage, pageSize]
  );

  const {
    data,
    isLoading,
    error: rawError,
    refetch,
  } = useAsyncRead(mentorFeedbackReadModel, activeKey, fetcher);

  const view =
    activeKey !== null
      ? mentorFeedbackReadModel.resolveView(activeKey, { data, isLoading })
      : null;

  const setPage = useCallback((nextPage: number) => {
    setPageState(Math.max(1, Math.floor(nextPage)));
  }, []);

  return {
    items: view?.items ?? EMPTY_FEEDBACK_ITEMS,
    totalRatingCount: view?.totalRatingCount ?? null,
    ratingAverage: view?.ratingAverage ?? null,
    completedMeetingCount: view?.completedMeetingCount ?? null,
    page: view?.page ?? effectivePage,
    pageSize: view?.pageSize ?? pageSize,
    isLoading: canFetch && isLoading,
    hasLoaded: view?.hasLoaded ?? false,
    isFallbackEmpty: view?.isFallbackEmpty ?? false,
    error: canFetch && rawError !== null ? MENTOR_FEEDBACK_LOAD_ERROR : null,
    setPage,
    reload: refetch,
  };
}
