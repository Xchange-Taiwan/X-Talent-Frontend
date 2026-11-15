import type { MentorRequest } from '@/types/mentor';
import type {
  TagCatalogGroupVO,
  TagCatalogsByBucket,
} from '@/types/tagCatalog';

export const DEFAULT_MENTOR_PAGE_LIMIT = 9;

export const SEARCH_PARAM_KEY = 'q';
export const SORT_BY_PARAM_KEY = 'sort_by';

export interface SearchParamReader {
  get(name: string): string | null;
}

export type SearchParamInput =
  (SearchParamReader & { toString(): string }) | string;

export type MentorPoolSortBy = 'recent' | 'popularity';

export type MentorPoolFilterKey =
  'filter_skills' | 'filter_topics' | 'filter_industries';

export interface MentorPoolQuery {
  search_pattern?: string;
  filter_skills?: string;
  filter_topics?: string;
  filter_industries?: string;
  sort_by?: MentorPoolSortBy;
}

export const UNFILTERED_MENTOR_POOL_QUERY: Readonly<MentorPoolQuery> =
  Object.freeze({});

export interface FilterOption {
  label: string;
  value: string;
}

export type FilterOptions = {
  [key: string]: {
    name: string;
    options: FilterOption[];
  };
};

export interface SelectFilters {
  [key: string]: {
    name: string;
    value: string;
  };
}

export interface ActiveFilterBadge {
  key: string;
  name: string;
  value: string;
  label: string;
}

export const DEFAULT_MENTOR_FILTER_OPTIONS: FilterOptions = {
  filter_skills: {
    name: '技能',
    options: [],
  },
  filter_topics: {
    name: '主題',
    options: [],
  },
  filter_industries: {
    name: '產業',
    options: [],
  },
};

function toParamReader(
  params: SearchParamReader | string | null | undefined
): SearchParamReader | null {
  if (!params) return null;
  return typeof params === 'string' ? new URLSearchParams(params) : params;
}

function toURLSearchParams(
  base: SearchParamInput | null | undefined
): URLSearchParams {
  if (!base) return new URLSearchParams('');
  return new URLSearchParams(typeof base === 'string' ? base : base.toString());
}

/**
 * Splits a raw filter value on commas, trims surrounding whitespace on each
 * token, drops empty/whitespace-only entries, and deduplicates while
 * preserving first-seen order.
 */
export function parseFilterTokens(value: string | null | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const tokens: string[] = [];
  value.split(',').forEach((raw) => {
    const trimmed = raw.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      tokens.push(trimmed);
    }
  });
  return tokens;
}

/**
 * Canonicalizes a filter parameter value by trimming, dropping empty tokens,
 * deduplicating, and sorting tokens so equivalent multi-select combinations
 * produce identical canonical representations.
 */
export function normalizeFilterValue(
  value: string | null | undefined
): string | undefined {
  const tokens = parseFilterTokens(value);
  if (tokens.length === 0) return undefined;
  return tokens.length === 1 ? tokens[0] : [...tokens].sort().join(',');
}

export function normalizeMentorPoolQuery(
  query?: MentorPoolQuery | null
): Readonly<MentorPoolQuery> {
  if (!query) {
    return UNFILTERED_MENTOR_POOL_QUERY;
  }

  const searchPattern = query.search_pattern?.trim() || undefined;
  const filterIndustries = normalizeFilterValue(query.filter_industries);
  const filterSkills = normalizeFilterValue(query.filter_skills);
  const filterTopics = normalizeFilterValue(query.filter_topics);
  const sortBy =
    query.sort_by === 'recent' || query.sort_by === 'popularity'
      ? query.sort_by
      : undefined;

  if (
    !searchPattern &&
    !filterIndustries &&
    !filterSkills &&
    !filterTopics &&
    !sortBy
  ) {
    return UNFILTERED_MENTOR_POOL_QUERY;
  }

  const normalized: MentorPoolQuery = {};
  if (filterIndustries) {
    normalized.filter_industries = filterIndustries;
  }
  if (filterSkills) {
    normalized.filter_skills = filterSkills;
  }
  if (filterTopics) {
    normalized.filter_topics = filterTopics;
  }
  if (searchPattern) {
    normalized.search_pattern = searchPattern;
  }
  if (sortBy) {
    normalized.sort_by = sortBy;
  }
  return Object.freeze(normalized);
}

export function parseMentorPoolQuery(
  params: SearchParamReader | string | null | undefined
): Readonly<MentorPoolQuery> {
  const reader = toParamReader(params);
  if (!reader) {
    return UNFILTERED_MENTOR_POOL_QUERY;
  }
  const rawSortBy = reader.get(SORT_BY_PARAM_KEY)?.trim();
  const sortBy =
    rawSortBy === 'recent' || rawSortBy === 'popularity'
      ? rawSortBy
      : undefined;

  return normalizeMentorPoolQuery({
    search_pattern: reader.get(SEARCH_PARAM_KEY) ?? undefined,
    filter_skills: reader.get('filter_skills') ?? undefined,
    filter_topics: reader.get('filter_topics') ?? undefined,
    filter_industries: reader.get('filter_industries') ?? undefined,
    sort_by: sortBy,
  });
}

export function isUnfilteredMentorPoolQuery(
  query?: MentorPoolQuery | null
): boolean {
  return normalizeMentorPoolQuery(query) === UNFILTERED_MENTOR_POOL_QUERY;
}

export function toMentorRequest(
  query: MentorPoolQuery,
  options: { limit?: number; cursor?: string | null } = {}
): MentorRequest {
  const normalized = normalizeMentorPoolQuery(query);
  const request: MentorRequest = {
    search_pattern: normalized.search_pattern ?? '',
    limit: options.limit ?? DEFAULT_MENTOR_PAGE_LIMIT,
  };
  if (normalized.filter_industries) {
    request.filter_industries = normalized.filter_industries;
  }
  if (normalized.filter_skills) {
    request.filter_skills = normalized.filter_skills;
  }
  if (normalized.filter_topics) {
    request.filter_topics = normalized.filter_topics;
  }
  if (normalized.sort_by) {
    request.sort_by = normalized.sort_by;
  }
  if (options.cursor) {
    request.cursor = options.cursor;
  }
  return request;
}

export function getSearchPatternFromParams(
  params: SearchParamReader | string | null | undefined
): string {
  return toParamReader(params)?.get(SEARCH_PARAM_KEY)?.trim() ?? '';
}

export function parseFiltersFromParams(
  params: SearchParamReader | string | null | undefined,
  options: FilterOptions = DEFAULT_MENTOR_FILTER_OPTIONS
): SelectFilters {
  const reader = toParamReader(params);
  if (!reader) return {};
  const result: SelectFilters = {};
  Object.keys(options).forEach((key) => {
    const tokens = parseFilterTokens(reader.get(key));
    const meta = options[key];
    if (tokens.length > 0 && meta) {
      result[key] = { name: meta.name, value: tokens.join(',') };
    }
  });
  return result;
}

export function hasAnyCondition(
  params: SearchParamReader | string | null | undefined
): boolean {
  return !isUnfilteredMentorPoolQuery(parseMentorPoolQuery(params));
}

export function setSearchPattern(
  base: SearchParamInput | null | undefined,
  q: string
): URLSearchParams {
  const next = toURLSearchParams(base);
  const trimmed = q.trim();
  if (trimmed) next.set(SEARCH_PARAM_KEY, trimmed);
  else next.delete(SEARCH_PARAM_KEY);
  return next;
}

export function setSelectedFiltersOnParams(
  base: SearchParamInput | null | undefined,
  filters: SelectFilters
): URLSearchParams {
  const next = toURLSearchParams(base);
  Array.from(next.keys()).forEach((existingKey) => {
    if (existingKey.startsWith('filter_')) {
      next.delete(existingKey);
    }
  });
  Object.entries(filters).forEach(([key, entry]) => {
    const tokens = parseFilterTokens(entry?.value);
    if (tokens.length > 0) {
      next.set(key, tokens.join(','));
    }
  });
  return next;
}

export function removeFilterFromParams(
  base: SearchParamInput | null | undefined,
  key: string,
  value?: string
): URLSearchParams {
  const next = toURLSearchParams(base);
  if (value === undefined) {
    next.delete(key);
    return next;
  }
  const targetToken = value.trim();
  const remaining = parseFilterTokens(next.get(key)).filter(
    (token) => token !== targetToken
  );
  if (remaining.length === 0) {
    next.delete(key);
  } else {
    next.set(key, remaining.join(','));
  }
  return next;
}

export function clearAllConditions(
  base: SearchParamInput | null | undefined
): URLSearchParams {
  const next = toURLSearchParams(base);
  next.delete(SEARCH_PARAM_KEY);
  next.delete(SORT_BY_PARAM_KEY);
  Array.from(next.keys()).forEach((key) => {
    if (key.startsWith('filter_')) {
      next.delete(key);
    }
  });
  return next;
}

export function buildMentorPoolHref(params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `/mentor-pool?${qs}` : '/mentor-pool';
}

export const buildHref = buildMentorPoolHref;

// BE search index stores filter targets (industry, skills, topics) as the
// `subject_group` code (e.g. "culture_education"), not the localized label —
// so the option's value must round-trip subject_group while `subject` stays
// as the display label.
export function subjectsToOptions(
  items: ReadonlyArray<{ subject_group?: string; subject?: string | null }>
): FilterOption[] {
  return items
    .map((item) => ({
      label: item.subject ?? '',
      value: item.subject_group ?? '',
    }))
    .filter((option) => Boolean(option.value));
}

// Filter dropdowns show the BE-stored leaf labels, not catalog group labels —
// flatten each bucket's groups down to leaves so the user picks tags directly.
export function flattenLeaves(
  groups: ReadonlyArray<TagCatalogGroupVO>
): { subject_group: string; subject: string }[] {
  return groups.flatMap((group) =>
    (group.leaves ?? []).map((leaf) => ({
      subject_group: leaf.subject_group,
      subject: leaf.subject,
    }))
  );
}

export function buildMentorFilterOptions(
  tagCatalog: Pick<
    TagCatalogsByBucket,
    'have_skill' | 'have_topic' | 'industry'
  >,
  baseOptions: FilterOptions = DEFAULT_MENTOR_FILTER_OPTIONS
): FilterOptions {
  return {
    ...baseOptions,
    filter_skills: {
      ...(baseOptions.filter_skills ??
        DEFAULT_MENTOR_FILTER_OPTIONS.filter_skills),
      options: subjectsToOptions(flattenLeaves(tagCatalog.have_skill)),
    },
    filter_topics: {
      ...(baseOptions.filter_topics ??
        DEFAULT_MENTOR_FILTER_OPTIONS.filter_topics),
      options: subjectsToOptions(flattenLeaves(tagCatalog.have_topic)),
    },
    filter_industries: {
      ...(baseOptions.filter_industries ??
        DEFAULT_MENTOR_FILTER_OPTIONS.filter_industries),
      options: subjectsToOptions(tagCatalog.industry),
    },
  };
}

export function resolveActiveFilterBadges(
  selectedFilters: SelectFilters,
  options: FilterOptions = DEFAULT_MENTOR_FILTER_OPTIONS
): ActiveFilterBadge[] {
  return Object.entries(selectedFilters).flatMap(([key, filter]) => {
    if (!filter) return [];
    const tokens = parseFilterTokens(filter.value);
    if (tokens.length === 0) return [];
    const optionList = options[key]?.options ?? [];
    return tokens.map((token) => {
      const label = optionList.find((o) => o.value === token)?.label ?? token;
      return {
        key,
        name: filter.name,
        value: token,
        label,
      };
    });
  });
}
