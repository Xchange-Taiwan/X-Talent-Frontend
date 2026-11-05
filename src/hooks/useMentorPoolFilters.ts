'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';

import { filterOptions as defaultFilterOptions } from '@/app/mentor-pool/data';
import {
  buildHref,
  clearAllConditions,
  getSearchPatternFromParams,
  hasAnyCondition,
  type MentorPoolFetchConditions,
  paramsToFetchConditions,
  parseFiltersFromParams,
  removeFilterFromParams,
  setSearchPattern,
  setSelectedFiltersOnParams,
} from '@/app/mentor-pool/searchParams';
import type {
  FilterOptions,
  SelectFilters,
} from '@/components/filter/MentorFilterDropdown';
import { trackEvent } from '@/lib/analytics';

export interface ActiveFilterBadge {
  key: string;
  name: string;
  value: string;
  label: string;
}

export function resolveActiveFilterBadges(
  selectedFilters: SelectFilters,
  filterOptions: FilterOptions = defaultFilterOptions
): ActiveFilterBadge[] {
  return Object.entries(selectedFilters).map(([key, filter]) => {
    const label =
      filterOptions[key]?.options.find((o) => o.value === filter.value)
        ?.label ?? filter.value;
    return {
      key,
      name: filter.name,
      value: filter.value,
      label,
    };
  });
}

export interface UseMentorPoolFiltersOptions {
  filterOptions?: FilterOptions;
}

export function useMentorPoolFilters(options?: UseMentorPoolFiltersOptions) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const resolvedFilterOptions = options?.filterOptions ?? defaultFilterOptions;
  const searchQuery = getSearchPatternFromParams(params);
  const selectedFilters = useMemo(
    () => parseFiltersFromParams(params),
    [params]
  );
  const hasConditions = hasAnyCondition(params);
  const fetchConditions = useMemo<MentorPoolFetchConditions>(
    () => paramsToFetchConditions(params),
    [params]
  );

  const activeFilterBadges = useMemo<ActiveFilterBadge[]>(
    () => resolveActiveFilterBadges(selectedFilters, resolvedFilterOptions),
    [selectedFilters, resolvedFilterOptions]
  );

  const setSearchQuery = useCallback(
    (query: string) => {
      const next = setSearchPattern(params, query);
      startTransition(() => {
        router.push(buildHref(next));
      });
    },
    [params, router]
  );

  const setFilters = useCallback(
    (filters: SelectFilters) => {
      const next = setSelectedFiltersOnParams(params, filters);
      startTransition(() => {
        router.push(buildHref(next));
      });
    },
    [params, router]
  );

  const removeFilter = useCallback(
    (key: string) => {
      const next = removeFilterFromParams(params, key);
      startTransition(() => {
        router.push(buildHref(next));
      });
    },
    [params, router]
  );

  const clearAll = useCallback(() => {
    trackEvent({ name: 'mentor_pool_clear_all_filters_click' });
    const next = clearAllConditions(params);
    startTransition(() => {
      router.push(buildHref(next));
    });
  }, [params, router]);

  return {
    params,
    searchQuery,
    selectedFilters,
    hasConditions,
    fetchConditions,
    activeFilterBadges,
    isReplacing: isPending,
    setSearchQuery,
    setFilters,
    removeFilter,
    clearAll,
  };
}
