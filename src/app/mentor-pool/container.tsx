'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import avatarImage from '@/assets/default-avatar.png';
import {
  fetchMentorsEnriched,
  MentorType,
} from '@/services/search-mentor/mentors';

import { PAGE_LIMIT } from './constants';
import { filterOptions } from './data';
import { useMentorPoolState } from './MentorPoolStateProvider';
import MentorPoolUI from './ui';

interface Props {
  initialMentors: MentorType[];
  initialCursor: string;
  initialMentorCount: number;
}

export default function MentorPoolContainer({
  initialMentors,
  initialCursor,
  initialMentorCount,
}: Props) {
  const {
    searchPattern,
    selectedFilters,
    sessionRestored,
    hasRestoredState,
    setFilters,
    removeFilter,
  } = useMentorPoolState();

  const [mentorCount, setMentorCount] = useState<number>(initialMentorCount);
  const [mentors, setMentors] = useState<MentorType[]>(initialMentors);
  const [isNoResults, setIsNoResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(initialCursor);
  const isLoadingRef = useRef(false);
  // Monotonic counter — every fetch claims an id. Late responses whose id no
  // longer matches the current value are stale and must not touch state.
  const requestIdRef = useRef(0);
  // After the first run, treat further searchPattern/filter changes as user-
  // driven and always refetch (regardless of restored state).
  const didInitialRunRef = useRef(false);

  const fetchMentorsBySearch = useCallback(async () => {
    const myRequestId = ++requestIdRef.current;
    const filters = Object.fromEntries(
      Object.entries(selectedFilters).map(([key, value]) => [key, value.value])
    );
    const param = {
      searchPattern,
      limit: PAGE_LIMIT,
      cursor: '',
      ...filters,
    };
    setIsLoading(true);
    setIsReplacing(true);
    isLoadingRef.current = true;
    let rtnList: MentorType[] = [];
    try {
      rtnList = (await fetchMentorsEnriched(param)).map((mentor) => ({
        ...mentor,
        avatar:
          typeof mentor.avatar === 'string' && mentor.avatar
            ? `${mentor.avatar}${mentor.updated_at ? `?cb=${mentor.updated_at}` : ''}`
            : avatarImage,
      }));
    } finally {
      if (myRequestId === requestIdRef.current) {
        setIsLoading(false);
        setIsReplacing(false);
        isLoadingRef.current = false;
      }
    }
    if (myRequestId !== requestIdRef.current) return;
    if (rtnList.length > 0) {
      setMentors(rtnList);
      setMentorCount(rtnList.length);
      setCursor(rtnList.at(-1)?.updated_at?.toString());
      setIsNoResults(false);
      return;
    }
    setMentors([]);
    setMentorCount(0);
    setCursor('');
    setIsNoResults(true);
  }, [searchPattern, selectedFilters]);

  const fetchMoreMentors = useCallback(async () => {
    const myRequestId = ++requestIdRef.current;
    const filters = Object.fromEntries(
      Object.entries(selectedFilters).map(([key, value]) => [key, value.value])
    );
    const param = {
      searchPattern,
      limit: PAGE_LIMIT,
      cursor,
      ...filters,
    };
    setIsLoading(true);
    isLoadingRef.current = true;
    let rtnList: MentorType[] = [];
    try {
      rtnList = (await fetchMentorsEnriched(param)).map((mentor) => ({
        ...mentor,
        avatar:
          typeof mentor.avatar === 'string' && mentor.avatar
            ? `${mentor.avatar}${mentor.updated_at ? `?cb=${mentor.updated_at}` : ''}`
            : avatarImage,
      }));
    } finally {
      if (myRequestId === requestIdRef.current) {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    }
    if (myRequestId !== requestIdRef.current) return;
    if (rtnList.length > 0) {
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
      return;
    }
    setIsNoResults(true);
  }, [selectedFilters, searchPattern, cursor]);

  const handleScrollToBottom = useCallback(async () => {
    if (mentors.length % PAGE_LIMIT || isLoadingRef.current) return;
    await fetchMoreMentors();
  }, [mentors.length, fetchMoreMentors]);

  // Drives both the initial restore-and-refetch and subsequent search/filter
  // changes. On first run, only refetch if sessionStorage held persisted state
  // (otherwise SSR-provided initial mentors are correct). After that, any
  // search/filter change is user-driven and always refetches.
  useEffect(() => {
    if (!sessionRestored) return;
    if (!didInitialRunRef.current) {
      didInitialRunRef.current = true;
      if (!hasRestoredState) return;
    }
    fetchMentorsBySearch();
  }, [sessionRestored, hasRestoredState, fetchMentorsBySearch]);

  return (
    <MentorPoolUI
      mentors={mentors}
      mentorCount={mentorCount}
      isLoading={isLoading}
      isReplacing={isReplacing}
      isNoResults={isNoResults}
      selectedFilters={selectedFilters}
      filterOptions={filterOptions}
      onFilterChange={setFilters}
      onRemoveFilter={removeFilter}
      onScrollToBottom={handleScrollToBottom}
    />
  );
}
