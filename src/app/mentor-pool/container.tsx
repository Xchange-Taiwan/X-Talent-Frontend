'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';

import avatarImage from '@/assets/default-avatar.png';
import { SelectFilters } from '@/components/filter/MentorFilterDropdown';
import { fetchMentors, MentorType } from '@/services/search-mentor/mentors';

import { filterOptions } from './data';

const MentorPoolUI = dynamic(() => import('./ui'));

const PAGE_LIMIT = 9;

export default function MentorPoolContainer() {
  const [searchPattern, setSearchPattern] = useState('');
  const [mentorCount, setMentorCount] = useState<number>(0);
  const [mentors, setMentors] = useState<MentorType[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<SelectFilters>({});
  const [isNoResults, setIsNoResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>('');
  const isLoadingRef = useRef(false);

  const handleFilterChange = useCallback((options: SelectFilters) => {
    setSelectedFilters(options);
  }, []);

  const handleSearch = useCallback(async (queryWords: string) => {
    setSearchPattern(queryWords);
  }, []);

  const removeFilter = useCallback((key: string) => {
    setSelectedFilters((prevFilters) => {
      const newFilters = { ...prevFilters };
      delete newFilters[key];
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
      rtnList = await fetchMentors(param);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
    if (rtnList.length > 0) {
      rtnList.forEach((mentor) => {
        mentor.avatar = avatarImage;
      });
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
      rtnList = await fetchMentors(param);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
    if (rtnList.length > 0) {
      rtnList.forEach((mentor) => {
        mentor.avatar = avatarImage;
      });
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

  useEffect(() => {
    fetchMentorsBySearch();
  }, [fetchMentorsBySearch]);

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
