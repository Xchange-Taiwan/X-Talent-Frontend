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
import { AsyncReadManager } from '@/lib/asyncReadManager';
import { createKeyedCache } from '@/lib/createKeyedCache';
import { fetchMentors } from '@/services/search-mentor/mentors';
import type { MentorType } from '@/types/mentor';

export const mentorPoolCache = createKeyedCache<string, MentorType[]>();
export const mentorPoolReadManager = new AsyncReadManager<string, MentorType[]>(
  mentorPoolCache
);

export interface MentorPoolPageState {
  mentors: MentorType[];
  cursor: string | undefined;
  hasMore: boolean;
  mentorCount: number;
  isNoResults: boolean;
  hasError: boolean;
}

export type MentorPageAction =
  | { type: 'replace'; page: MentorType[] }
  | { type: 'append'; page: MentorType[] };

export function applyMentorPage(
  state: MentorPoolPageState,
  action: MentorPageAction
): MentorPoolPageState {
  switch (action.type) {
    case 'replace': {
      const { page } = action;
      return {
        mentors: page,
        cursor: page.at(-1)?.updated_at?.toString(),
        hasMore: page.length === PAGE_LIMIT,
        mentorCount: page.length,
        isNoResults: page.length === 0,
        hasError: false,
      };
    }
    case 'append': {
      const { page } = action;
      if (page.length === 0) {
        return {
          ...state,
          hasMore: false,
        };
      }

      const newMentors = page.filter(
        (newMentor) =>
          !state.mentors.some(
            (prevMentor) => prevMentor.user_id === newMentor.user_id
          )
      );

      return {
        mentors: [...state.mentors, ...newMentors],
        cursor: page.at(-1)?.updated_at?.toString(),
        hasMore: page.length === PAGE_LIMIT,
        mentorCount: state.mentorCount + page.length,
        isNoResults: false,
        hasError: false,
      };
    }
    default:
      return state;
  }
}

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
  const hasInitialFilters = hasAnyCondition(params);

  const getInitialUnfilteredState = useCallback(
    (): MentorPoolPageState => ({
      mentors: initialMentors,
      cursor: initialMentors.at(-1)?.updated_at?.toString(),
      hasMore: initialMentors.length === PAGE_LIMIT,
      mentorCount: initialMentorCount,
      isNoResults: initialMentors.length === 0,
      hasError: hasInitialFilters ? false : (initialError ?? false),
    }),
    [initialMentors, initialMentorCount, hasInitialFilters, initialError]
  );

  const [pageState, setPageState] = useState<MentorPoolPageState>(() => {
    if (hasInitialFilters) {
      return {
        mentors: [],
        cursor: undefined,
        hasMore: true,
        mentorCount: 0,
        isNoResults: false,
        hasError: false,
      };
    }
    return getInitialUnfilteredState();
  });

  const { run: runLoadMore, isPending: isLoadMorePending } = useAsyncAction();
  const [retryCount, setRetryCount] = useState<number>(0);
  const hasClientFetched = useRef(false);
  const prevFilterKeyRef = useRef<string | null>(null);

  // Derive filterKey for useAsyncRead
  const filterKey =
    hasAnyCondition(params) ||
    (initialError && (retryCount > 0 || hasClientFetched.current))
      ? `filter_${params.toString()}_retry_${retryCount}`
      : null;

  // Let useAsyncRead handle the main data fetch, loading, error, and cancellation
  const {
    data: fetchedData,
    isLoading: isFilterLoading,
    error: filterError,
  } = useAsyncRead(
    mentorPoolReadManager,
    filterKey,
    (signal) => {
      const conditions = paramsToFetchConditions(params);
      return fetchMentors(
        { ...conditions, limit: PAGE_LIMIT, cursor: '' },
        signal
      );
    },
    { force: true } // Always force refresh to query fresh results on filter change
  );

  // Derived loading state combining local filter loading (Latest Wins) and pagination loading
  const isLoading =
    filterKey !== null
      ? !hasClientFetched.current || isFilterLoading || isLoadMorePending
      : isFilterLoading || isLoadMorePending;

  // Synchronize useAsyncRead state back to local pageState
  useEffect(() => {
    if (filterKey === null) {
      if (prevFilterKeyRef.current !== null) {
        setPageState(getInitialUnfilteredState());
        prevFilterKeyRef.current = null;
      }
      return;
    }
    prevFilterKeyRef.current = filterKey;

    if (isFilterLoading) {
      setPageState((prev) => {
        if (
          prev.mentors.length === 0 &&
          !prev.isNoResults &&
          !prev.hasMore &&
          !prev.hasError
        ) {
          return prev; // Bailout to avoid redundant state updates
        }
        return {
          ...prev,
          mentors: [],
          isNoResults: false,
          hasMore: false,
          hasError: false,
        };
      });
      hasClientFetched.current = true;
      return;
    }

    if (filterError) {
      toast({
        variant: 'destructive',
        title: '載入失敗',
        description: '無法獲取導師，請稍後再試。',
        duration: 5000,
      });
      setPageState((prev) => {
        if (
          prev.mentors.length === 0 &&
          prev.mentorCount === 0 &&
          prev.hasError &&
          !prev.isNoResults
        ) {
          return prev; // Bailout to avoid loop
        }
        return {
          ...prev,
          mentors: [],
          mentorCount: 0,
          hasError: true,
          isNoResults: false,
        };
      });
      return;
    }

    if (fetchedData) {
      setPageState((prev) => {
        if (prev.mentors === fetchedData) {
          return prev; // Bailout!
        }
        return applyMentorPage(prev, { type: 'replace', page: fetchedData });
      });
    }
  }, [
    filterKey,
    fetchedData,
    isFilterLoading,
    filterError,
    getInitialUnfilteredState,
    toast,
  ]);

  const fetchMoreMentors = useCallback(async () => {
    const currentKey = filterKey;
    const conditions = paramsToFetchConditions(params);
    const param = {
      ...conditions,
      limit: PAGE_LIMIT,
      cursor: pageState.cursor,
    };

    const rtnList = await runLoadMore(() => fetchMentors(param), {
      preventConcurrent: true,
      throwError: false,
      onError: () => {
        if (filterKey === currentKey) {
          toast({
            variant: 'destructive',
            title: '載入失敗',
            description: '無法獲取導師，請稍後再試。',
            duration: 5000,
          });
          setPageState((prev) => ({
            ...prev,
            hasError: prev.mentors.length === 0,
          }));
        }
      },
    });

    if (!rtnList) return;
    if (filterKey === currentKey) {
      setPageState((prev) =>
        applyMentorPage(prev, { type: 'append', page: rtnList })
      );
    }
  }, [params, pageState.cursor, runLoadMore, filterKey, toast]);

  const handleScrollToBottom = useCallback(async () => {
    if (!pageState.hasMore || isLoading) return;
    await fetchMoreMentors();
  }, [pageState.hasMore, fetchMoreMentors, isLoading]);

  const handleRetry = useCallback(() => {
    setRetryCount((prev) => prev + 1);
  }, []);

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
