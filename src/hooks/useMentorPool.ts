'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { PAGE_LIMIT } from '@/app/mentor-pool/constants';
import { useToast } from '@/components/ui/use-toast';
import { useAsyncRead } from '@/hooks/useAsyncRead';
import { isAbortError } from '@/lib/errorUtils';
import {
  applyMentorPage,
  EMPTY_MENTOR_POOL_STATE,
  fetchMentorPoolPageOne,
  type MentorPageAction,
  type MentorPoolPageState,
  mentorPoolReadModel,
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

  const query = mentorPoolReadModel.resolveQuery(params);
  const initialQueryRef = useRef(query);

  const initialData = useMemo(
    () =>
      mentorPoolReadModel.resolveSSRInitialData(query, {
        initialMentors,
        initialNextCursor,
        initialMentorCount,
        initialError,
        initialQuery: initialQueryRef.current,
      }),
    [query, initialMentors, initialNextCursor, initialMentorCount, initialError]
  );

  // Client-only SSR hydration: never mutates the singleton during SSR render
  // ([DEPLOY-04]), while seeding the unfiltered cache slot on client mount.
  useEffect(() => {
    mentorPoolReadModel.primeUnfilteredFromSSR({
      initialMentors,
      initialNextCursor,
      initialMentorCount,
      initialError,
      initialQuery: initialQueryRef.current,
    });
  }, [initialMentors, initialNextCursor, initialMentorCount, initialError]);

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
  } = useAsyncRead(mentorPoolReadModel, query, fetcher, {
    initialData,
  });

  const pageState = useMemo<MentorPoolPageState>(() => {
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
  }, [cachedPageState, pageError]);

  const handleScrollToBottom = useCallback(async () => {
    if (!pageState.hasMore || isLoading) return;
    const outcome = await mentorPoolReadModel.loadMore(query, fetchMentors, {
      limit: PAGE_LIMIT,
      fallbackState: pageState,
    });
    if (outcome.status === 'error' && !outcome.deduplicated) {
      showErrorToast();
    }
  }, [query, pageState, isLoading, showErrorToast]);

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
    handleRetry: refetch,
  };
}
