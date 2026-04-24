'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';

import avatarImage from '@/assets/default-avatar.png';
import { SelectFilters } from '@/components/filter/MentorFilterDropdown';
import {
  fetchMentorsEnriched,
  MentorType,
} from '@/services/search-mentor/mentors';

import { filterOptions } from './data';

const MentorPoolUI = dynamic(() => import('./ui'));

const PAGE_LIMIT = 9;
const SESSION_KEY_PATTERN = 'mentor-pool:searchPattern';
const SESSION_KEY_FILTERS = 'mentor-pool:selectedFilters';

export default function MentorPoolContainer() {
  const [searchPattern, setSearchPattern] = useState('');
  const [mentorCount, setMentorCount] = useState<number>(0);
  const [mentors, setMentors] = useState<MentorType[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<SelectFilters>({});
  const [isNoResults, setIsNoResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>('');
  const [sessionRestored, setSessionRestored] = useState(false);
  const isLoadingRef = useRef(false);

  // Restore persisted search state before the first fetch
  useEffect(() => {
    try {
      const savedPattern = sessionStorage.getItem(SESSION_KEY_PATTERN);
      if (savedPattern !== null) setSearchPattern(savedPattern);

      const savedFilters = sessionStorage.getItem(SESSION_KEY_FILTERS);
      if (savedFilters) setSelectedFilters(JSON.parse(savedFilters));
    } catch {
      // sessionStorage unavailable (private browsing restrictions etc.) — ignore
    } finally {
      setSessionRestored(true);
    }
  }, []);

  const handleFilterChange = useCallback((options: SelectFilters) => {
    setSelectedFilters(options);
    try {
      sessionStorage.setItem(SESSION_KEY_FILTERS, JSON.stringify(options));
    } catch {}
  }, []);

  const handleSearch = useCallback(async (queryWords: string) => {
    setSearchPattern(queryWords);
    try {
      sessionStorage.setItem(SESSION_KEY_PATTERN, queryWords);
    } catch {}
  }, []);

  const removeFilter = useCallback((key: string) => {
    setSelectedFilters((prevFilters) => {
      const newFilters = { ...prevFilters };
      delete newFilters[key];
      try {
        sessionStorage.setItem(SESSION_KEY_FILTERS, JSON.stringify(newFilters));
      } catch {}
      return newFilters;
    });
  }, []);

  const fetchMentorsBySearch = useCallback(async () => {
    const filters = Object.fromEntries(
      Object.entries(selectedFilters).map(([key, value]) => [key, value.value])
    );
    const param = {
      searchPattern,
      limit: PAGE_LIMIT,
      cursor: '',
      ...filters,
    };
    setMentors([]);
    setMentorCount(0);
    setIsLoading(true);
    isLoadingRef.current = true;
    let rtnList: MentorType[] = [];
    try {
      rtnList = (await fetchMentorsEnriched(param)).map((mentor) => ({
        ...mentor,
        avatar:
          typeof mentor.avatar === 'string' && mentor.avatar
            ? mentor.avatar
            : avatarImage,
      }));
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
    if (rtnList.length > 0) {
      setMentors(rtnList);
      setMentorCount(rtnList.length);
      setCursor(rtnList.at(-1)?.updated_at?.toString());
      setIsNoResults(false);
      return;
    }
    setIsNoResults(true);
  }, [searchPattern, selectedFilters]);

  const fetchMoreMentors = useCallback(async () => {
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
            ? mentor.avatar
            : avatarImage,
      }));
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
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

  // Only start fetching after sessionStorage has been read — avoids a wasted
  // request with empty state immediately followed by one with the restored state.
  useEffect(() => {
    if (!sessionRestored) return;
    fetchMentorsBySearch();
  }, [sessionRestored, fetchMentorsBySearch]);

  return (
    <MentorPoolUI
      mentors={mentors}
      mentorCount={mentorCount}
      isLoading={isLoading}
      isNoResults={isNoResults}
      selectedFilters={selectedFilters}
      filterOptions={filterOptions}
      onSearch={handleSearch}
      onFilterChange={handleFilterChange}
      onRemoveFilter={removeFilter}
      onScrollToBottom={handleScrollToBottom}
    />
  );
}
