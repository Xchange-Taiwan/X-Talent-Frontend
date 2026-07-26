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

interface UseMentorPoolProps {
  initialMentors: MentorType[];
  initialCursor: string;
  initialMentorCount: number;
  params: ReturnType<typeof useSearchParams>;
  labelMap: Map<string, string>;
}

export function useMentorPool({
  initialMentors,
  initialCursor,
  initialMentorCount,
  params,
  labelMap,
}: UseMentorPoolProps) {
  const { toast } = useToast();

  const hasInitialFilters = hasAnyCondition(params);

  const [mentorCount, setMentorCount] = useState<number>(
    hasInitialFilters ? 0 : initialMentorCount
  );

  // mentors state holds the fetched mentors with only resolveMentorAvatar applied.
  // This keeps avatar calculation cached but preserves raw have_topic codes in state for dynamic localization.
  const [mentors, setMentors] = useState<MentorType[]>(() => {
    const initial = hasInitialFilters ? [] : initialMentors;
    return initial.map(resolveMentorAvatar);
  });

  const [isNoResults, setIsNoResults] = useState(
    hasInitialFilters ? false : initialMentors.length === 0
  );
  const [isLoading, setIsLoading] = useState(hasInitialFilters);
  const [cursor, setCursor] = useState<string | undefined>(
    hasInitialFilters ? undefined : initialCursor
  );
  const [hasMore, setHasMore] = useState<boolean>(
    hasInitialFilters ? true : initialMentors.length === PAGE_LIMIT
  );

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
      const resolvedInitial = initialMentors.map(resolveMentorAvatar);
      setMentors(resolvedInitial);
      setMentorCount(initialMentorCount);
      setCursor(initialCursor);
      setIsNoResults(initialMentors.length === 0);
      setHasMore(initialMentors.length === PAGE_LIMIT);
      setIsLoading(false);
      isLoadingRef.current = false;
      return;
    }

    const conditions = paramsToFetchConditions(params);
    setIsLoading(true);
    isLoadingRef.current = true;
    setIsNoResults(false);

    fetchMentors({ ...conditions, limit: PAGE_LIMIT, cursor: '' })
      .then((list) => {
        if (myRequestId !== requestIdRef.current) return;
        const resolvedList = list.map(resolveMentorAvatar);
        setMentors(resolvedList);
        setMentorCount(resolvedList.length);
        setCursor(resolvedList.at(-1)?.updated_at?.toString());
        setIsNoResults(resolvedList.length === 0);
        setHasMore(resolvedList.length === PAGE_LIMIT);
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
      cursor,
    };
    setIsLoading(true);
    isLoadingRef.current = true;
    let rtnList: MentorType[] = [];
    try {
      rtnList = await fetchMentors(param);
      if (myRequestId === requestIdRef.current) {
        if (rtnList.length === 0) {
          setHasMore(false);
        } else {
          const resolvedList = rtnList.map(resolveMentorAvatar);
          setMentors((prevMentors) => {
            const newMentors = resolvedList.filter(
              (newMentor) =>
                !prevMentors.some(
                  (prevMentor) => prevMentor.user_id === newMentor.user_id
                )
            );
            return [...prevMentors, ...newMentors];
          });
          setMentorCount((prev) => prev + rtnList.length);
          setCursor(rtnList.at(-1)?.updated_at?.toString());
          setHasMore(rtnList.length === PAGE_LIMIT);
        }
      }
    } catch (error) {
      handleError(myRequestId, 'Fetch more mentors error:', error);
    } finally {
      if (myRequestId === requestIdRef.current) {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    }
  }, [params, cursor, handleError]);

  const handleScrollToBottom = useCallback(async () => {
    if (!hasMore || isLoadingRef.current) return;
    await fetchMoreMentors();
  }, [hasMore, fetchMoreMentors]);

  // Dynamically translate tag labels inside useMemo on return. This preserves dynamic localization
  // updates (e.g. language switching) without coupling translation state updates to useEffect fetching.
  const mentorsForUI = useMemo(
    () =>
      mentors.map((m) => ({
        ...m,
        have_topic: m.have_topic.map((c) => labelMap.get(c) ?? c),
      })),
    [mentors, labelMap]
  );

  return {
    mentors: mentorsForUI,
    mentorCount,
    isLoading,
    isNoResults,
    handleScrollToBottom,
  };
}
