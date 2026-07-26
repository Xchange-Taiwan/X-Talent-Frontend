'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

import type {
  FilterOptions,
  SelectFilters,
} from '@/components/filter/MentorFilterDropdown';
import { useToast } from '@/components/ui/use-toast';
import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
import { trackEvent } from '@/lib/analytics';
import {
  buildTagLabelMap,
  type TagCatalogGroupVO,
  type TagCatalogsByBucket,
} from '@/services/profile/tagCatalog';
import { resolveMentor } from '@/services/search-mentor/mapMentor';
import { fetchMentors, MentorType } from '@/services/search-mentor/mentors';

import { PAGE_LIMIT } from './constants';
import { filterOptions } from './data';
import {
  buildHref,
  clearAllConditions,
  hasAnyCondition,
  paramsToFetchConditions,
  parseFiltersFromParams,
  removeFilterFromParams,
  setSelectedFiltersOnParams,
} from './searchParams';
import MentorPoolUI from './ui';

// BE search index stores filter targets (industry, skills, topics) as the
// `subject_group` code (e.g. "culture_education"), not the localized label —
// so the option's value must round-trip subject_group while `subject` stays
// as the display label.
function subjectsToOptions(
  items: ReadonlyArray<{ subject_group?: string; subject?: string | null }>
): { label: string; value: string }[] {
  return items
    .map((i) => ({ label: i.subject ?? '', value: i.subject_group ?? '' }))
    .filter((o) => o.value);
}

// Filter dropdowns show the BE-stored leaf labels, not catalog group labels —
// flatten each bucket's groups down to leaves so the user picks tags directly.
function flattenLeaves(
  groups: TagCatalogGroupVO[]
): { subject_group: string; subject: string }[] {
  return groups.flatMap((g) =>
    g.leaves.map((leaf) => ({
      subject_group: leaf.subject_group,
      subject: leaf.subject,
    }))
  );
}

interface Props {
  initialMentors: MentorType[];
  initialCursor: string;
  initialMentorCount: number;
  initialTagCatalog: TagCatalogsByBucket;
}

export default function MentorPoolContainer({
  initialMentors,
  initialCursor,
  initialMentorCount,
  initialTagCatalog,
}: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const selectedFilters = parseFiltersFromParams(params);
  const tagCatalog = useTagCatalog('zh_TW', initialTagCatalog);

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
        options: subjectsToOptions(tagCatalog.industry),
      },
    }),
    [tagCatalog.have_skill, tagCatalog.have_topic, tagCatalog.industry]
  );

  const labelMap = useMemo(() => buildTagLabelMap(tagCatalog), [tagCatalog]);

  // initialMentors is always the unfiltered list — a filtered deep link
  // must not render it even for a frame, so start empty/loading instead.
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
  // Monotonic counter — every fetch claims an id. Late responses whose id no
  // longer matches the current value are stale and must not touch state.
  const requestIdRef = useRef(0);

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
        if (myRequestId !== requestIdRef.current) return;
        console.error('Fetch mentors error:', error);
        setIsLoading(false);
        isLoadingRef.current = false;
        toast({
          variant: 'destructive',
          title: '載入失敗',
          description: '無法獲取導師列表，請稍後再試。',
        });
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
    } catch (error) {
      if (myRequestId === requestIdRef.current) {
        console.error('Fetch more mentors error:', error);
        toast({
          variant: 'destructive',
          title: '載入失敗',
          description: '無法獲取更多導師，請稍後再試。',
        });
      }
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
  }, [params, cursor, toast]);

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

  const resolvedMentors = useMemo(
    () => mentors.map((m) => resolveMentor(m, labelMap)),
    [mentors, labelMap]
  );

  return (
    <MentorPoolUI
      mentors={resolvedMentors}
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
