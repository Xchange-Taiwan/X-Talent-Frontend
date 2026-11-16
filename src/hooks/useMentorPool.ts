'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { PAGE_LIMIT } from '@/app/mentor-pool/constants';
import { useToast } from '@/components/ui/use-toast';
import { useAsyncRead } from '@/hooks/useAsyncRead';
import { trackEvent } from '@/lib/analytics';
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

  const lastTrackedSearchKeyRef = useRef<string | null>(null);
  const hasKeyword = Boolean(query.search_pattern?.trim());
  const activeFilterCount = useMemo(() => {
    const countItems = (csv?: string) =>
      csv
        ? csv
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean).length
        : 0;
    return (
      countItems(query.filter_skills) +
      countItems(query.filter_topics) +
      countItems(query.filter_industries)
    );
  }, [query.filter_industries, query.filter_skills, query.filter_topics]);

  useEffect(() => {
    if (!hasKeyword && activeFilterCount === 0) {
      lastTrackedSearchKeyRef.current = null;
      return;
    }
    if (isLoading || pageState.hasError) return;
    if (listStatus !== 'success' && listStatus !== 'empty') return;

    const searchIdentityKey = JSON.stringify({
      q: query.search_pattern?.trim() ?? '',
      s: query.filter_skills ?? '',
      t: query.filter_topics ?? '',
      i: query.filter_industries ?? '',
      sort: query.sort_by ?? '',
      count: pageState.mentorCount,
      empty: listStatus === 'empty',
    });
    if (lastTrackedSearchKeyRef.current === searchIdentityKey) return;
    lastTrackedSearchKeyRef.current = searchIdentityKey;

    trackEvent({
      name: 'view_search_results',
      feature: 'mentor_pool',
      metadata: {
        result_count: pageState.mentorCount,
        has_keyword: hasKeyword,
        active_filter_count: activeFilterCount,
      },
    });

    if (listStatus === 'empty' || pageState.mentorCount === 0) {
      trackEvent({
        name: 'mentor_search_zero_results',
        feature: 'mentor_pool',
        metadata: {
          has_keyword: hasKeyword,
          active_filter_count: activeFilterCount,
        },
      });
    }
  }, [
    activeFilterCount,
    hasKeyword,
    isLoading,
    listStatus,
    pageState.hasError,
    pageState.mentorCount,
    query.filter_industries,
    query.filter_skills,
    query.filter_topics,
    query.search_pattern,
    query.sort_by,
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
