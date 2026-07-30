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
import {
  fetchMentors,
  type MentorType,
} from '@/services/search-mentor/mentors';

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

  const { run, isPending: isActionPending } = useAsyncAction();

  const [retryCount, setRetryCount] = useState<number>(0);
  const requestIdRef = useRef(0);
  const hasClientFetched = useRef(false);

  // Derived loading state to preserve synchronous true-state for initial filters on mount
  const isLoading = hasInitialFilters
    ? !hasClientFetched.current || isActionPending
    : isActionPending;

  // Centralized, DRY error handling helper to manage state transitions and error toast feedback
  const handleError = useCallback(
    (myRequestId: number, isLoadMore = false) => {
      if (myRequestId !== requestIdRef.current) return;
      toast({
        variant: 'destructive',
        title: '載入失敗',
        description: '無法獲取導師，請稍後再試。',
        duration: 5000,
      });
      setPageState((prev) => {
        if (!isLoadMore) {
          return {
            ...prev,
            mentors: [],
            mentorCount: 0,
            hasError: true,
            isNoResults: false,
          };
        }
        return {
          ...prev,
          hasError: prev.mentors.length === 0,
        };
      });
    },
    [toast]
  );

  // Refetches on every params change, including initial mount, since
  // MentorPoolWithData no longer refetches per request. Clearing filters
  // reuses `initial*` (already the unfiltered snapshot) instead of a fetch.
  useEffect(() => {
    const myRequestId = ++requestIdRef.current;

    if (
      !hasAnyCondition(params) &&
      !(initialError && (retryCount > 0 || hasClientFetched.current))
    ) {
      setPageState(getInitialUnfilteredState());
      return;
    }

    const conditions = paramsToFetchConditions(params);
    setPageState((prev) => ({
      ...prev,
      isNoResults: false,
      hasMore: false,
      hasError: false,
    }));
    hasClientFetched.current = true;

    run(() => fetchMentors({ ...conditions, limit: PAGE_LIMIT, cursor: '' }), {
      preventConcurrent: false, // For params change, do not block subsequent valid filtering requests
      throwError: false,
      onError: () => handleError(myRequestId, false),
    }).then((list) => {
      if (!list) return;
      if (myRequestId !== requestIdRef.current) return;
      setPageState((prev) =>
        applyMentorPage(prev, { type: 'replace', page: list })
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString(), retryCount]);

  const fetchMoreMentors = useCallback(async () => {
    if (isActionPending) return;

    let myRequestId: number | undefined;
    const conditions = paramsToFetchConditions(params);
    const param = {
      ...conditions,
      limit: PAGE_LIMIT,
      cursor: pageState.cursor,
    };

    const rtnList = await run(
      () => {
        myRequestId = ++requestIdRef.current;
        return fetchMentors(param);
      },
      {
        preventConcurrent: true,
        throwError: false,
        onError: () => {
          if (myRequestId !== undefined) {
            handleError(myRequestId, true);
          }
        },
      }
    );

    if (!rtnList) return;
    if (myRequestId === requestIdRef.current) {
      setPageState((prev) =>
        applyMentorPage(prev, { type: 'append', page: rtnList })
      );
    }
  }, [params, pageState.cursor, run, isActionPending, handleError]);

  const handleScrollToBottom = useCallback(async () => {
    if (!pageState.hasMore || isActionPending) return;
    await fetchMoreMentors();
  }, [pageState.hasMore, fetchMoreMentors, isActionPending]);

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
