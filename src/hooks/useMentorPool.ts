'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

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

  // Use a mutable ref to store the latest labelMap to prevent background catalog revalidations
  // from triggering redundant API requests or resetting the user's scrolled pagination state.
  const labelMapRef = useRef(labelMap);
  labelMapRef.current = labelMap;

  // Helper function to resolve avatar cache busting and localize tags inside render-free state update
  const resolveMentorItem = useCallback(
    (m: MentorType, map: Map<string, string>) => {
      const resolved = resolveMentorAvatar(m);
      return {
        ...resolved,
        have_topic: resolved.have_topic.map((c) => map.get(c) ?? c),
      };
    },
    []
  );

  const [mentorCount, setMentorCount] = useState<number>(
    hasInitialFilters ? 0 : initialMentorCount
  );
  const [mentors, setMentors] = useState<MentorType[]>(() => {
    const initial = hasInitialFilters ? [] : initialMentors;
    return initial.map((m) => resolveMentorItem(m, labelMap));
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
      const resolvedInitial = initialMentors.map((m) =>
        resolveMentorItem(m, labelMapRef.current)
      );
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
        const resolvedList = list.map((m) =>
          resolveMentorItem(m, labelMapRef.current)
        );
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
          const resolvedList = rtnList.map((m) =>
            resolveMentorItem(m, labelMapRef.current)
          );
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
  }, [params, cursor, resolveMentorItem, handleError]);

  const handleScrollToBottom = useCallback(async () => {
    if (!hasMore || isLoadingRef.current) return;
    await fetchMoreMentors();
  }, [hasMore, fetchMoreMentors]);

  return {
    mentors,
    mentorCount,
    isLoading,
    isNoResults,
    handleScrollToBottom,
  };
}
