'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { PAGE_LIMIT } from '@/app/mentor-pool/constants';
import { useToast } from '@/components/ui/use-toast';
import { useAsyncRead } from '@/hooks/useAsyncRead';
import { isAbortError } from '@/lib/errorUtils';
import {
  applyMentorPage,
  EMPTY_MENTOR_POOL_STATE,
  fetchMentorPoolPageOne,
  isUnfilteredMentorPoolQuery,
  type MentorPageAction,
  type MentorPoolPageState,
  type MentorPoolQuery,
  mentorPoolReadModel,
  parseMentorPoolQuery,
  toMentorPoolCacheKey,
  UNFILTERED_MENTOR_POOL_QUERY,
} from '@/lib/mentor/mentorPoolReadModel';
import { fetchMentors } from '@/services/search-mentor/mentors';
import type { MentorType } from '@/types/mentor';

export { applyMentorPage, type MentorPageAction, type MentorPoolPageState };

interface UseMentorPoolProps {
  initialMentors: MentorType[];
  initialNextCursor?: string | null;
  initialMentorCount: number;
  params: ReturnType<typeof useSearchParams>;
  initialError?: boolean;
}

export function useMentorPool({
  initialMentors,
  initialNextCursor = null,
  initialMentorCount,
  params,
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

  const parsedQuery = parseMentorPoolQuery(params);
  const canonicalKey = toMentorPoolCacheKey(parsedQuery);
  // useAsyncRead compares keys by reference to detect a key-change edge during
  // render, so stabilize the query object by its canonical cache key.
  const query = useMemo<MentorPoolQuery>(
    () => parsedQuery,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canonicalKey]
  );
  const hasConditions = !isUnfilteredMentorPoolQuery(query);

  const initialUnfilteredState = useMemo(
    () =>
      mentorPoolReadModel.buildInitialUnfilteredState({
        initialMentors,
        initialNextCursor,
        initialMentorCount,
        hasInitialFilters: hasConditions,
        initialError,
      }),
    [
      initialMentors,
      initialNextCursor,
      initialMentorCount,
      hasConditions,
      initialError,
    ]
  );

  // Client-only cache priming: never mutates the singleton during SSR render,
  // so consecutive SSR renders on a warm Node process after ISR revalidation
  // always reflect fresh `initialMentors`, while landing on a filtered URL and
  // later clearing filters on the client still hits the initial unfiltered page.
  useEffect(() => {
    if (
      !initialError &&
      initialMentors.length > 0 &&
      mentorPoolReadModel.get(UNFILTERED_MENTOR_POOL_QUERY) === undefined
    ) {
      mentorPoolReadModel.set(
        UNFILTERED_MENTOR_POOL_QUERY,
        mentorPoolReadModel.buildInitialUnfilteredState({
          initialMentors,
          initialNextCursor,
          initialMentorCount,
          hasInitialFilters: false,
          initialError: false,
        })
      );
    }
  }, [initialError, initialMentors, initialNextCursor, initialMentorCount]);

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
  const activeQuery = shouldHoldInitialError ? null : query;

  const fetcher = useCallback(
    (signal: AbortSignal) =>
      fetchMentorPoolPageOne(query, fetchMentors, signal, PAGE_LIMIT).catch(
        (err) => {
          if (!isAbortError(err, signal)) {
            showErrorToast();
          }
          throw err;
        }
      ),
    [query, showErrorToast]
  );

  const {
    data: cachedPageState,
    isLoading,
    error: pageError,
    refetch,
  } = useAsyncRead(mentorPoolReadModel, activeQuery, fetcher, {
    initialData:
      !hasConditions && !initialError && initialMentors.length > 0
        ? initialUnfilteredState
        : undefined,
  });

  const pageState = useMemo<MentorPoolPageState>(() => {
    if (shouldHoldInitialError) {
      return initialUnfilteredState;
    }
    if (cachedPageState) {
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
  ]);

  const handleScrollToBottom = useCallback(async () => {
    if (!activeQuery || !pageState.hasMore || isLoading) return;
    const outcome = await mentorPoolReadModel.loadMore(
      activeQuery,
      fetchMentors,
      {
        limit: PAGE_LIMIT,
        fallbackState: pageState,
      }
    );
    if (outcome.status === 'error' && !outcome.deduplicated) {
      showErrorToast();
    }
  }, [activeQuery, pageState, isLoading, showErrorToast]);

  const handleRetry = useCallback(() => {
    if (shouldHoldInitialError) {
      setHasClientActivity(true);
      return;
    }
    refetch();
  }, [shouldHoldInitialError, refetch]);

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
    mentors: pageState.mentors,
    mentorCount: pageState.mentorCount,
    isLoading,
    isNoResults: pageState.isNoResults,
    hasError: pageState.hasError,
    listStatus,
    handleScrollToBottom,
    handleRetry,
  };
}
