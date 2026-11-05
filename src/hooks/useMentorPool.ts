'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PAGE_LIMIT } from '@/app/mentor-pool/constants';
import {
  hasAnyCondition,
  paramsToFetchConditions,
} from '@/app/mentor-pool/searchParams';
import { useToast } from '@/components/ui/use-toast';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useAsyncRead } from '@/hooks/useAsyncRead';
import {
  applyMentorPage,
  EMPTY_MENTOR_POOL_STATE,
  type MentorPageAction,
  type MentorPoolPageState,
  mentorPoolReadManager,
  mentorPoolStore,
  toMentorPoolConditionKey,
} from '@/lib/cache/mentorPoolCache';
import { isAbortError } from '@/lib/errorUtils';
import { fetchMentors } from '@/services/search-mentor/mentors';
import type { MentorType } from '@/types/mentor';

export { applyMentorPage, type MentorPageAction, type MentorPoolPageState };

interface UseMentorPoolProps {
  initialMentors: MentorType[];
  initialMentorCount: number;
  params: ReturnType<typeof useSearchParams>;
  labelMap: Map<string, string>;
  initialError?: boolean;
}

export function useMentorPool({
  initialMentors,
  initialMentorCount,
  params,
  labelMap,
  initialError,
}: UseMentorPoolProps) {
  const { toast } = useToast();

  const showErrorToast = useCallback(() => {
    toast({
      variant: 'destructive',
      title: '載入失敗',
      description: '無法獲取導師，請稍後再試。',
      duration: 5000,
    });
  }, [toast]);

  const hasConditions = hasAnyCondition(params);
  const paramsString = params?.toString() ?? '';
  const conditionKey = toMentorPoolConditionKey(paramsString, hasConditions);

  const initialUnfilteredState = useMemo(
    () =>
      mentorPoolStore.seedInitialUnfiltered({
        initialMentors,
        initialMentorCount,
        hasInitialFilters: hasConditions,
        initialError,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialMentors, initialMentorCount, initialError]
  );

  // Track whether any client-side filter navigation or retry has occurred so
  // clearing filters after an SSR initialError fetches fresh instead of
  // falling back to the stale SSR error state.
  const [hasClientActivity, setHasClientActivity] = useState(hasConditions);
  useEffect(() => {
    if (hasConditions && !hasClientActivity) {
      setHasClientActivity(true);
    }
  }, [hasConditions, hasClientActivity]);

  const shouldHoldInitialError =
    Boolean(initialError) && !hasConditions && !hasClientActivity;
  const activeKey = shouldHoldInitialError ? null : conditionKey;

  const latestKeyRef = useRef(activeKey);
  const loadMoreAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    latestKeyRef.current = activeKey;
    loadMoreAbortRef.current?.abort();
    loadMoreAbortRef.current = null;
  }, [activeKey]);

  const fetcher = useCallback(
    (signal: AbortSignal) => {
      const conditions = paramsToFetchConditions(params);
      return mentorPoolStore
        .fetchPageOne(
          (limit, sig) =>
            fetchMentors({ ...conditions, limit, cursor: '' }, sig),
          signal,
          PAGE_LIMIT
        )
        .catch((err) => {
          if (!isAbortError(err, signal)) {
            showErrorToast();
          }
          throw err;
        });
    },
    [params, showErrorToast]
  );

  const {
    data: cachedPageState,
    isLoading: isPageLoading,
    error: pageError,
    refetch,
  } = useAsyncRead(mentorPoolReadManager, activeKey, fetcher, {
    initialData:
      !hasConditions && !initialError ? initialUnfilteredState : undefined,
  });

  const { run: runLoadMore, isPending: isLoadMorePending } = useAsyncAction();
  const [loadMoreErrorKey, setLoadMoreErrorKey] = useState<string | null>(null);

  const pageState = useMemo<MentorPoolPageState>(() => {
    if (shouldHoldInitialError) {
      return initialUnfilteredState;
    }
    if (cachedPageState) {
      if (
        loadMoreErrorKey === activeKey &&
        cachedPageState.mentors.length === 0
      ) {
        return { ...cachedPageState, hasError: true };
      }
      return cachedPageState;
    }
    if (pageError) {
      return {
        ...EMPTY_MENTOR_POOL_STATE,
        hasMore: false,
        hasError: true,
      };
    }
    return {
      ...EMPTY_MENTOR_POOL_STATE,
      hasMore: false,
    };
  }, [
    shouldHoldInitialError,
    initialUnfilteredState,
    cachedPageState,
    pageError,
    loadMoreErrorKey,
    activeKey,
  ]);

  const isLoading = isPageLoading || isLoadMorePending;

  const fetchMoreMentors = useCallback(async () => {
    const currentKey = activeKey;
    if (!currentKey) return;
    const conditions = paramsToFetchConditions(params);
    const param = {
      ...conditions,
      limit: PAGE_LIMIT,
      cursor: pageState.cursor,
    };

    const controller = new AbortController();
    loadMoreAbortRef.current = controller;

    const rtnList = await runLoadMore(
      () => fetchMentors(param, controller.signal),
      {
        preventConcurrent: true,
        throwError: false,
        onError: (err) => {
          if (
            latestKeyRef.current === currentKey &&
            !isAbortError(err, controller.signal)
          ) {
            showErrorToast();
            if (pageState.mentors.length === 0) {
              setLoadMoreErrorKey(currentKey);
            }
          }
        },
      }
    );

    if (!rtnList) return;
    if (latestKeyRef.current === currentKey) {
      setLoadMoreErrorKey(null);
      mentorPoolStore.appendPage(currentKey, pageState, rtnList);
    }
  }, [activeKey, params, pageState, runLoadMore, showErrorToast]);

  const handleScrollToBottom = useCallback(async () => {
    if (!pageState.hasMore || isLoading) return;
    await fetchMoreMentors();
  }, [pageState.hasMore, fetchMoreMentors, isLoading]);

  const handleRetry = useCallback(() => {
    setLoadMoreErrorKey(null);
    if (shouldHoldInitialError) {
      setHasClientActivity(true);
      return;
    }
    refetch();
  }, [shouldHoldInitialError, refetch]);

  // Dynamically translate tag labels inside useMemo on return. This preserves dynamic localization
  // updates (e.g. language switching) without coupling translation state updates to useEffect fetching.
  const mentorsForUI = useMemo(
    () =>
      pageState.mentors.map((m) => ({
        ...m,
        have_topic: m.have_topic.map((c) => labelMap.get(c) ?? c),
      })),
    [pageState.mentors, labelMap]
  );

  const listStatus = useMemo<'loading' | 'error' | 'empty' | 'success'>(() => {
    if (pageState.mentors.length > 0) return 'success';
    if (isLoading && !pageState.hasError) return 'loading';
    if (pageState.hasError) return 'error';
    if (pageState.isNoResults) return 'empty';
    return 'loading';
  }, [
    pageState.mentors.length,
    isLoading,
    pageState.hasError,
    pageState.isNoResults,
  ]);

  return {
    mentors: mentorsForUI,
    mentorCount: pageState.mentorCount,
    isLoading,
    isNoResults: pageState.isNoResults,
    hasError: pageState.hasError,
    listStatus,
    handleScrollToBottom,
    handleRetry,
  };
}
