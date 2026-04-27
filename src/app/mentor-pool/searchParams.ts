import type { ReadonlyURLSearchParams } from 'next/navigation';

import type { SelectFilters } from '@/components/filter/MentorFilterDropdown';

import { filterOptions } from './data';

export const SEARCH_PARAM_KEY = 'q';

export const FILTER_KEYS: ReadonlyArray<string> = Object.keys(filterOptions);

export type ServerSearchParams = Record<string, string | string[] | undefined>;

type AnyParams = URLSearchParams | ReadonlyURLSearchParams;

export interface MentorPoolFetchConditions {
  searchPattern: string;
  filter_skills?: string;
  filter_topics?: string;
  filter_industries?: string;
}

function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function toURLSearchParams(
  searchParams: ServerSearchParams
): URLSearchParams {
  const next = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    const v = pickString(value);
    if (v) next.set(key, v);
  });
  return next;
}

export function getSearchPatternFromParams(params: AnyParams | null): string {
  return params?.get(SEARCH_PARAM_KEY) ?? '';
}

export function parseFiltersFromParams(
  params: AnyParams | null
): SelectFilters {
  if (!params) return {};
  const result: SelectFilters = {};
  FILTER_KEYS.forEach((key) => {
    const value = params.get(key);
    const meta = filterOptions[key];
    if (value && meta) {
      result[key] = { name: meta.name, value };
    }
  });
  return result;
}

export function paramsToFetchConditions(
  params: AnyParams | null
): MentorPoolFetchConditions {
  const conditions: MentorPoolFetchConditions = {
    searchPattern: getSearchPatternFromParams(params),
  };
  if (!params) return conditions;
  const writable = conditions as MentorPoolFetchConditions &
    Record<string, string | undefined>;
  FILTER_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) {
      writable[key] = value;
    }
  });
  return conditions;
}

export function hasAnyCondition(params: AnyParams | null): boolean {
  if (!params) return false;
  if (params.get(SEARCH_PARAM_KEY)) return true;
  return FILTER_KEYS.some((key) => Boolean(params.get(key)));
}

export function setSearchPattern(
  base: AnyParams | null,
  q: string
): URLSearchParams {
  const next = new URLSearchParams(base?.toString() ?? '');
  if (q) next.set(SEARCH_PARAM_KEY, q);
  else next.delete(SEARCH_PARAM_KEY);
  return next;
}

export function setSelectedFiltersOnParams(
  base: AnyParams | null,
  filters: SelectFilters
): URLSearchParams {
  const next = new URLSearchParams(base?.toString() ?? '');
  FILTER_KEYS.forEach((key) => next.delete(key));
  Object.entries(filters).forEach(([key, value]) => {
    if (value?.value) next.set(key, value.value);
  });
  return next;
}

export function removeFilterFromParams(
  base: AnyParams | null,
  key: string
): URLSearchParams {
  const next = new URLSearchParams(base?.toString() ?? '');
  next.delete(key);
  return next;
}

export function buildHref(params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `/mentor-pool?${qs}` : '/mentor-pool';
}
