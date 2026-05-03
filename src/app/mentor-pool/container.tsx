'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useRef, useState, useTransition } from 'react';

import avatarImage from '@/assets/default-avatar.png';
import type {
  FilterOptions,
  SelectFilters,
} from '@/components/filter/MentorFilterDropdown';
import useIndustries from '@/hooks/user/industry/useIndustries';
import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
import { trackEvent } from '@/lib/analytics';
import type { ProfessionVO } from '@/services/profile/industries';
import type {
  TagCatalogGroupVO,
  TagCatalogsByBucket,
} from '@/services/profile/tagCatalog';
import { fetchMentors, MentorType } from '@/services/search-mentor/mentors';

import { PAGE_LIMIT } from './constants';
import { filterOptions } from './data';
import {
  buildHref,
  clearAllConditions,
  paramsToFetchConditions,
  parseFiltersFromParams,
  removeFilterFromParams,
  setSelectedFiltersOnParams,
} from './searchParams';
import MentorPoolUI from './ui';

function subjectsToOptions(
  items: ReadonlyArray<{ subject?: string | null }>
): { label: string; value: string }[] {
  return items
    .map((i) => ({ label: i.subject ?? '', value: i.subject ?? '' }))
    .filter((o) => o.value);
}

// Filter dropdowns show the BE-stored leaf labels, not catalog group labels —
// flatten each bucket's groups down to leaves so the user picks tags directly.
function flattenLeaves(groups: TagCatalogGroupVO[]): { subject: string }[] {
  return groups.flatMap((g) =>
    g.leaves.map((leaf) => ({ subject: leaf.subject }))
  );
}

interface Props {
  initialMentors: MentorType[];
  initialCursor: string;
  initialMentorCount: number;
  initialIndustries: ProfessionVO[];
  initialTagCatalog: TagCatalogsByBucket;
}

export default function MentorPoolContainer({
  initialMentors,
  initialCursor,
  initialMentorCount,
  initialIndustries,
  initialTagCatalog,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const selectedFilters = parseFiltersFromParams(params);
  const tagCatalog = useTagCatalog('zh_TW', initialTagCatalog);
  const { industries } = useIndustries('zh_TW', initialIndustries);

  const dynamicFilterOptions = useMemo<FilterOptions>(
    () => ({
      ...filterOptions,
      filter_skills: {
        ...filterOptions.filter_skills,
        options: subjectsToOptions(flattenLeaves(tagCatalog.have_skill)),
      },
      filter_topics: {
        ...filterOptions.filter_topics,
        options: subjectsToOptions(flattenLeaves(tagCatalog.have_topic)),
      },
      filter_industries: {
        ...filterOptions.filter_industries,
        options: subjectsToOptions(industries),
      },
    }),
    [tagCatalog.have_skill, tagCatalog.have_topic, industries]
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
      rtnList = (await fetchMentors(param)).map((mentor) => ({
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

  const handleClearAll = useCallback(() => {
    trackEvent({ name: 'mentor_pool_clear_all_filters_click' });
    const next = clearAllConditions(params);
    startTransition(() => {
      router.push(buildHref(next));
    });
  }, [params, router]);

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
      onClearAll={handleClearAll}
      onScrollToBottom={handleScrollToBottom}
    />
  );
}
