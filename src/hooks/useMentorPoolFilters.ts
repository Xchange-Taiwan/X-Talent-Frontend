'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';

import { trackEvent } from '@/lib/analytics';
import {
  type ActiveFilterBadge,
  buildMentorPoolHref,
  clearAllConditions,
  DEFAULT_MENTOR_FILTER_OPTIONS,
  type FilterOptions,
  getSearchPatternFromParams,
  hasAnyCondition,
  parseFiltersFromParams,
  removeFilterFromParams,
  resolveActiveFilterBadges,
  type SelectFilters,
  setSearchPattern,
  setSelectedFiltersOnParams,
} from '@/lib/mentor/mentorPoolQuery';

export { type ActiveFilterBadge, resolveActiveFilterBadges };

export interface UseMentorPoolFiltersOptions {
  filterOptions?: FilterOptions;
}

/**
 * Lightweight hook for components that only read or update the `q` keyword
 * parameter (e.g. `MentorPoolSearchBar` and `PopularPositionChips`), avoiding
 * filter parsing and localized badge resolution on every render.
 */
export function useMentorPoolSearchQuery() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const searchQuery = getSearchPatternFromParams(params);

  const setSearchQuery = useCallback(
    (query: string) => {
      const next = setSearchPattern(params, query);
      startTransition(() => {
        router.push(buildMentorPoolHref(next));
      });
    },
    [params, router]
  );

  return {
    params,
    searchQuery,
    isReplacing: isPending,
    setSearchQuery,
  };
}

export function useMentorPoolFilters(options?: UseMentorPoolFiltersOptions) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const resolvedFilterOptions =
    options?.filterOptions ?? DEFAULT_MENTOR_FILTER_OPTIONS;
  const searchQuery = getSearchPatternFromParams(params);
  const selectedFilters = useMemo(
    () => parseFiltersFromParams(params, resolvedFilterOptions),
    [params, resolvedFilterOptions]
  );
  const hasConditions = hasAnyCondition(params);

  const activeFilterBadges = useMemo<ActiveFilterBadge[]>(
    () => resolveActiveFilterBadges(selectedFilters, resolvedFilterOptions),
    [selectedFilters, resolvedFilterOptions]
  );

  const setSearchQuery = useCallback(
    (query: string) => {
      const next = setSearchPattern(params, query);
      startTransition(() => {
        router.push(buildMentorPoolHref(next));
      });
    },
    [params, router]
  );

  const setFilters = useCallback(
    (filters: SelectFilters) => {
      const next = setSelectedFiltersOnParams(params, filters);
      startTransition(() => {
        router.push(buildMentorPoolHref(next));
      });
    },
    [params, router]
  );

  const removeFilter = useCallback(
    (key: string, value?: string) => {
      const next = removeFilterFromParams(params, key, value);
      startTransition(() => {
        router.push(buildMentorPoolHref(next));
      });
    },
    [params, router]
  );

  const clearAll = useCallback(() => {
    trackEvent({ name: 'mentor_pool_clear_all_filters_click' });
    const next = clearAllConditions(params);
    startTransition(() => {
      router.push(buildMentorPoolHref(next));
    });
  }, [params, router]);

  return {
    params,
    searchQuery,
    selectedFilters,
    hasConditions,
    activeFilterBadges,
    isReplacing: isPending,
    setSearchQuery,
    setFilters,
    removeFilter,
    clearAll,
  };
}
