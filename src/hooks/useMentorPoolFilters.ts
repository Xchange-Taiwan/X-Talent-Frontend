'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';

import { trackEvent } from '@/lib/analytics';
import {
  type ActiveFilterBadge,
  buildMentorFilterOptions,
  buildMentorPoolHref,
  clearAllConditions,
  DEFAULT_MENTOR_FILTER_OPTIONS,
  type FilterOptions,
  getSearchPatternFromParams,
  type MentorFilterCatalogInput,
  projectMentorPoolDiscoveryState,
  removeFilterFromParams,
  resolveActiveFilterBadges,
  type SelectFilters,
  setSearchPattern,
  setSelectedFiltersOnParams,
} from '@/lib/mentor/mentorPoolQuery';

export { type ActiveFilterBadge, resolveActiveFilterBadges };

export interface UseMentorPoolFiltersOptions {
  tagCatalog?: MentorFilterCatalogInput;
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

  const haveSkill = options?.tagCatalog?.have_skill;
  const haveTopic = options?.tagCatalog?.have_topic;
  const industry = options?.tagCatalog?.industry;
  const explicitFilterOptions = options?.filterOptions;

  const resolvedFilterOptions = useMemo<FilterOptions>(() => {
    if (haveSkill || haveTopic || industry) {
      return buildMentorFilterOptions(
        {
          have_skill: haveSkill,
          have_topic: haveTopic,
          industry,
        },
        explicitFilterOptions ?? DEFAULT_MENTOR_FILTER_OPTIONS
      );
    }
    return explicitFilterOptions ?? DEFAULT_MENTOR_FILTER_OPTIONS;
  }, [explicitFilterOptions, haveSkill, haveTopic, industry]);

  const paramsSnapshotKey = params?.toString() ?? '';
  const projection = useMemo(
    () =>
      projectMentorPoolDiscoveryState(params, undefined, {
        filterOptions: resolvedFilterOptions,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- paramsSnapshotKey tracks in-place SearchParams mock mutations in tests
    [params, paramsSnapshotKey, resolvedFilterOptions]
  );

  const queryKey = projection.queryKey;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKey canonically determines normalized query
  const query = useMemo(() => projection.query, [queryKey]);

  const setSearchQuery = useCallback(
    (nextQuery: string) => {
      const next = setSearchPattern(params, nextQuery);
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
    query,
    queryKey,
    searchQuery: projection.searchQuery,
    selectedTokensByKey: projection.selectedTokensByKey,
    selectedFilters: projection.selectedFilters,
    filterOptions: projection.filterOptions,
    hasConditions: projection.hasConditions,
    activeFilterBadges: projection.activeBadges,
    prioritizedCardTagCodes: projection.prioritizedCardTagCodes,
    isReplacing: isPending,
    setSearchQuery,
    setFilters,
    removeFilter,
    clearAll,
  };
}
