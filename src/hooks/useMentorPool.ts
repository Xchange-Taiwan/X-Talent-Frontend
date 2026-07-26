'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { PAGE_LIMIT } from '@/app/mentor-pool/constants';
import {
  hasAnyCondition,
  paramsToFetchConditions,
} from '@/app/mentor-pool/searchParams';
import { useToast } from '@/components/ui/use-toast';
import {
  fetchMentors,
  type MentorType,
} from '@/services/search-mentor/mentors';

interface UseMentorPoolProps {
  initialMentors: MentorType[];
  initialCursor: string;
  initialMentorCount: number;
}

export function useMentorPool({
  initialMentors,
  initialCursor,
  initialMentorCount,
}: UseMentorPoolProps) {
  const params = useSearchParams();
  const { toast } = useToast();

  const hasInitialFilters = hasAnyCondition(params);

  const [mentorCount, setMentorCount] = useState<number>(
    hasInitialFilters ? 0 : initialMentorCount
  );
  const [mentors, setMentors] = useState<MentorType[]>(
    hasInitialFilters ? [] : initialMentors
  );
  const [isNoResults, setIsNoResults] = useState(
    hasInitialFilters ? false : initialMentors.length === 0
  );
  const [isLoading, setIsLoading] = useState(hasInitialFilters);
  const [cursor, setCursor] = useState<string | undefined>(
    hasInitialFilters ? undefined : initialCursor
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
      setMentors(initialMentors);
      setMentorCount(initialMentorCount);
      setCursor(initialCursor);
      setIsNoResults(initialMentors.length === 0);
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
        setMentors(list);
        setMentorCount(list.length);
        setCursor(list.at(-1)?.updated_at?.toString());
        setIsNoResults(list.length === 0);
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
          setIsNoResults(true);
        } else {
          setMentors((prevMentors) => {
            const newMentors = rtnList.filter(
              (newMentor) =>
                !prevMentors.some(
                  (prevMentor) => prevMentor.user_id === newMentor.user_id
                )
            );
            return [...prevMentors, ...newMentors];
          });
          setMentorCount((prev) => prev + rtnList.length);
          setCursor(rtnList.at(-1)?.updated_at?.toString());
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
    if (mentors.length % PAGE_LIMIT || isLoadingRef.current) return;
    await fetchMoreMentors();
  }, [mentors.length, fetchMoreMentors]);

  return {
    mentors,
    mentorCount,
    isLoading,
    isNoResults,
    handleScrollToBottom,
  };
}
