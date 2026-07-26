'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PAGE_LIMIT } from '@/app/mentor-pool/constants';
import {
  hasAnyCondition,
  paramsToFetchConditions,
} from '@/app/mentor-pool/searchParams';
import { useToast } from '@/components/ui/use-toast';
import { resolveMentorAvatar } from '@/services/search-mentor/mapMentor';
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
}

export function useMentorPool({
  initialMentors,
  initialMentorCount,
  params,
  labelMap,
}: UseMentorPoolProps) {
  const { toast } = useToast();

  const hasInitialFilters = hasAnyCondition(params);

  // Cache resolved initial mentors to trigger React's state bailout on mount, preventing redundant list re-renders.
  const resolvedInitialMentors = useMemo(
    () => initialMentors.map(resolveMentorAvatar),
    [initialMentors]
  );

  const getInitialUnfilteredState = useCallback(
    (): MentorPoolPageState => ({
      mentors: resolvedInitialMentors,
      cursor: resolvedInitialMentors.at(-1)?.updated_at?.toString(),
      hasMore: resolvedInitialMentors.length === PAGE_LIMIT,
      mentorCount: initialMentorCount,
      isNoResults: resolvedInitialMentors.length === 0,
    }),
    [resolvedInitialMentors, initialMentorCount]
  );

  const [pageState, setPageState] = useState<MentorPoolPageState>(() => {
    if (hasInitialFilters) {
      return {
        mentors: [],
        cursor: undefined,
        hasMore: true,
        mentorCount: 0,
        isNoResults: false,
      };
    }
    return getInitialUnfilteredState();
  });

  const [isLoading, setIsLoading] = useState(hasInitialFilters);

  const isLoadingRef = useRef(false);
  const requestIdRef = useRef(0);

  // Consolidated error handler helper to eliminate duplicated code
  const handleError = useCallback(
    (myRequestId: number, message: string, error: unknown) => {
      if (myRequestId !== requestIdRef.current) return;
      console.error(
        message,
        error instanceof Error ? error.message : String(error)
      );
      setIsLoading(false);
      isLoadingRef.current = false;
      toast({
        variant: 'destructive',
        title: '載入失敗',
        description: '無法獲取導師，請稍後再試。',
      });
    },
    [toast]
  );

  // Refetches on every params change, including initial mount, since
  // MentorPoolWithData no longer refetches per request. Clearing filters
  // reuses `initial*` (already the unfiltered snapshot) instead of a fetch.
  useEffect(() => {
    const myRequestId = ++requestIdRef.current;

    if (!hasAnyCondition(params)) {
      setPageState(getInitialUnfilteredState());
      setIsLoading(false);
      isLoadingRef.current = false;
      return;
    }

    const conditions = paramsToFetchConditions(params);
    setIsLoading(true);
    isLoadingRef.current = true;
    setPageState((prev) => ({
      ...prev,
      isNoResults: false,
      hasMore: false,
    }));

    fetchMentors({ ...conditions, limit: PAGE_LIMIT, cursor: '' })
      .then((list) => {
        if (myRequestId !== requestIdRef.current) return;
        const resolvedList = list.map(resolveMentorAvatar);
        setPageState((prev) =>
          applyMentorPage(prev, { type: 'replace', page: resolvedList })
        );
        setIsLoading(false);
        isLoadingRef.current = false;
      })
      .catch((error) => {
        handleError(myRequestId, 'Fetch mentors error:', error);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  const fetchMoreMentors = useCallback(async () => {
    const myRequestId = ++requestIdRef.current;
    const conditions = paramsToFetchConditions(params);
    const param = {
      ...conditions,
      limit: PAGE_LIMIT,
      cursor: pageState.cursor,
    };
    setIsLoading(true);
    isLoadingRef.current = true;
    try {
      const rtnList = await fetchMentors(param);
      if (myRequestId === requestIdRef.current) {
        const resolvedList = rtnList.map(resolveMentorAvatar);
        setPageState((prev) =>
          applyMentorPage(prev, { type: 'append', page: resolvedList })
        );
      }
    } catch (error) {
      handleError(myRequestId, 'Fetch more mentors error:', error);
    } finally {
      if (myRequestId === requestIdRef.current) {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    }
  }, [params, pageState.cursor, handleError]);

  const handleScrollToBottom = useCallback(async () => {
    if (!pageState.hasMore || isLoadingRef.current) return;
    await fetchMoreMentors();
  }, [pageState.hasMore, fetchMoreMentors]);

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

  return {
    mentors: mentorsForUI,
    mentorCount: pageState.mentorCount,
    isLoading,
    isNoResults: pageState.isNoResults,
    handleScrollToBottom,
  };
}
