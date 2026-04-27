'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useRef, useState, useTransition } from 'react';

import avatarImage from '@/assets/default-avatar.png';
import type {
  FilterOptions,
  SelectFilters,
} from '@/components/filter/MentorFilterDropdown';
import useInterests from '@/hooks/user/interests/useInterests';
import type { InterestVO } from '@/services/profile/interests';
import {
  fetchMentorsEnriched,
  MentorType,
} from '@/services/search-mentor/mentors';

import { PAGE_LIMIT } from './constants';
import { filterOptions } from './data';
import {
  buildHref,
  paramsToFetchConditions,
  parseFiltersFromParams,
  removeFilterFromParams,
  setSelectedFiltersOnParams,
} from './searchParams';
import MentorPoolUI from './ui';

function interestsToOptions(
  items: InterestVO[]
): { label: string; value: string }[] {
  return items
    .map((i) => ({ label: i.subject ?? '', value: i.subject ?? '' }))
    .filter((o) => o.value);
}

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
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const selectedFilters = parseFiltersFromParams(params);
  const { expertises, whatIOffers } = useInterests('zh_TW');

  const dynamicFilterOptions = useMemo<FilterOptions>(
    () => ({
      ...filterOptions,
      filter_skills: {
        ...filterOptions.filter_skills,
        options: interestsToOptions(expertises),
      },
      filter_topics: {
        ...filterOptions.filter_topics,
        options: interestsToOptions(whatIOffers),
      },
    }),
    [expertises, whatIOffers]
  );

  const [mentorCount, setMentorCount] = useState<number>(initialMentorCount);
  const [mentors, setMentors] = useState<MentorType[]>(initialMentors);
  const [isNoResults, setIsNoResults] = useState(initialMentors.length === 0);
  const [isLoading, setIsLoading] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(initialCursor);
  const isLoadingRef = useRef(false);
  // Monotonic counter — every fetch claims an id. Late responses whose id no
  // longer matches the current value are stale and must not touch state.
  const requestIdRef = useRef(0);

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
  }, [params, cursor]);

  const handleScrollToBottom = useCallback(async () => {
    if (mentors.length % PAGE_LIMIT || isLoadingRef.current) return;
    await fetchMoreMentors();
  }, [mentors.length, fetchMoreMentors]);

  const handleFilterChange = useCallback(
    (filters: SelectFilters) => {
      const next = setSelectedFiltersOnParams(params, filters);
      startTransition(() => {
        router.push(buildHref(next));
      });
    },
    [params, router]
  );

  const handleRemoveFilter = useCallback(
    (key: string) => {
      const next = removeFilterFromParams(params, key);
      startTransition(() => {
        router.push(buildHref(next));
      });
    },
    [params, router]
  );

  return (
    <MentorPoolUI
      mentors={mentors}
      mentorCount={mentorCount}
      isLoading={isLoading}
      isReplacing={isPending}
      isNoResults={isNoResults}
      selectedFilters={selectedFilters}
      filterOptions={dynamicFilterOptions}
      onFilterChange={handleFilterChange}
      onRemoveFilter={handleRemoveFilter}
      onScrollToBottom={handleScrollToBottom}
    />
  );
}
