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

export type MentorFilterOptionSource =
  | {
      readonly kind: 'catalog_leaves';
      readonly bucket: 'have_skill' | 'have_topic';
    }
  | {
      readonly kind: 'catalog_flat';
      readonly bucket: 'industry';
    }
  | {
      readonly kind: 'static';
      readonly options: ReadonlyArray<FilterOption>;
    };

export interface MentorPoolFilterDimension {
  readonly key: MentorPoolFilterKey;
  readonly name: string;
  readonly optionSource: MentorFilterOptionSource;
  readonly prioritizeCardTags: boolean;
}

/**
 * Single declarative registry of mentor-pool filter dimensions.
 * Preserves canonical UI combobox order (`filter_skills`, `filter_topics`,
 * `filter_industries`), option source bindings, and card-tag prioritization.
 */
export const MENTOR_POOL_FILTER_DIMENSIONS: ReadonlyArray<MentorPoolFilterDimension> =
  Object.freeze([
    {
      key: 'filter_skills',
      name: '技能',
      optionSource: { kind: 'catalog_leaves', bucket: 'have_skill' },
      prioritizeCardTags: true,
    },
    {
      key: 'filter_topics',
      name: '主題',
      optionSource: { kind: 'catalog_leaves', bucket: 'have_topic' },
      prioritizeCardTags: true,
    },
    {
      key: 'filter_industries',
      name: '產業',
      optionSource: { kind: 'catalog_flat', bucket: 'industry' },
      prioritizeCardTags: false,
    },
  ]);

export const DEFAULT_MENTOR_FILTER_OPTIONS: FilterOptions = Object.fromEntries(
  MENTOR_POOL_FILTER_DIMENSIONS.map((dim) => [
    dim.key,
    {
      name: dim.name,
      options:
        dim.optionSource.kind === 'static' ? [...dim.optionSource.options] : [],
    },
  ])
);

export const EMPTY_PRIORITIZED_CARD_TAG_CODES: ReadonlySet<string> = new Set();

export type FilterDraft = Readonly<Record<string, readonly string[]>>;

export const EMPTY_FILTER_DRAFT: FilterDraft = Object.freeze({});

export type MentorFilterCatalogInput = Partial<
  Pick<TagCatalogsByBucket, 'have_skill' | 'have_topic' | 'industry'>
>;

export interface ProjectMentorPoolDiscoveryOptions {
  filterOptions?: FilterOptions;
  dimensions?: ReadonlyArray<MentorPoolFilterDimension>;
}

export interface MentorPoolDiscoveryProjection {
  query: Readonly<MentorPoolQuery>;
  queryKey: string;
  searchQuery: string;
  selectedTokensByKey: Readonly<Record<MentorPoolFilterKey, readonly string[]>>;
  selectedFilters: SelectFilters;
  filterOptions: FilterOptions;
  activeBadges: ActiveFilterBadge[];
  prioritizedCardTagCodes: ReadonlySet<string>;
  hasConditions: boolean;
}

export interface FilterApplyAnalyticsAttrs {
  'data-analytics-click': 'mentor_pool_filter_apply';
  'data-analytics-event': 'mentor_pool_filter_apply';
  'data-analytics-feature': 'mentor_pool';
  'data-analytics-location': 'filter_dropdown';
  'data-analytics-param-filter-type': string;
  'data-analytics-param-filter-value': string;
}

const CANONICAL_QUERIES = new WeakSet<MentorPoolQuery>([
  UNFILTERED_MENTOR_POOL_QUERY,
]);

function markCanonicalQuery(query: MentorPoolQuery): Readonly<MentorPoolQuery> {
  const frozen = Object.freeze(query);
  CANONICAL_QUERIES.add(frozen);
  return frozen;
}

function isSearchParamReader(value: unknown): value is SearchParamReader {
  return (
    typeof value === 'object' &&
    value !== null &&
    'get' in value &&
    typeof (value as SearchParamReader).get === 'function'
  );
}

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

function normalizeSortBy(
  rawSortBy: string | null | undefined
): MentorPoolSortBy | undefined {
  const trimmed = rawSortBy?.trim();
  return trimmed === 'recent' || trimmed === 'popularity' ? trimmed : undefined;
}

function canonicalizeTokens(tokens: readonly string[]): string | undefined {
  if (tokens.length === 0) return undefined;
  return tokens.length === 1 ? tokens[0] : [...tokens].sort().join(',');
}

/**
 * Canonicalizes a filter parameter value by trimming, dropping empty tokens,
 * deduplicating, and sorting tokens so equivalent multi-select combinations
 * produce identical canonical representations.
 */
export function normalizeFilterValue(
  value: string | null | undefined
): string | undefined {
  return canonicalizeTokens(parseFilterTokens(value));
}

export function normalizeMentorPoolQuery(
  query?: MentorPoolQuery | null
): Readonly<MentorPoolQuery> {
  if (!query) {
    return UNFILTERED_MENTOR_POOL_QUERY;
  }
  if (CANONICAL_QUERIES.has(query)) {
    return query;
  }

  const searchPattern = query.search_pattern?.trim() || undefined;
  const sortBy = normalizeSortBy(query.sort_by);
  const normalized: MentorPoolQuery = {};
  let hasAnyFilter = false;

  for (const dim of MENTOR_POOL_FILTER_DIMENSIONS) {
    const canonicalVal = normalizeFilterValue(query[dim.key]);
    if (canonicalVal) {
      normalized[dim.key] = canonicalVal;
      hasAnyFilter = true;
    }
  }

  if (!searchPattern && !hasAnyFilter && !sortBy) {
    return UNFILTERED_MENTOR_POOL_QUERY;
  }

  if (searchPattern) {
    normalized.search_pattern = searchPattern;
  }
  if (sortBy) {
    normalized.sort_by = sortBy;
  }
  return markCanonicalQuery(normalized);
}

export function parseMentorPoolQuery(
  params: SearchParamReader | string | null | undefined
): Readonly<MentorPoolQuery> {
  const reader = toParamReader(params);
  if (!reader) {
    return UNFILTERED_MENTOR_POOL_QUERY;
  }

  const rawQuery: MentorPoolQuery = {
    search_pattern: reader.get(SEARCH_PARAM_KEY) ?? undefined,
    sort_by: normalizeSortBy(reader.get(SORT_BY_PARAM_KEY)),
  };
  for (const dim of MENTOR_POOL_FILTER_DIMENSIONS) {
    rawQuery[dim.key] = reader.get(dim.key) ?? undefined;
  }
  return normalizeMentorPoolQuery(rawQuery);
}

export function isUnfilteredMentorPoolQuery(
  query?: MentorPoolQuery | null
): boolean {
  return normalizeMentorPoolQuery(query) === UNFILTERED_MENTOR_POOL_QUERY;
}

function serializeCanonicalQueryEntries(
  normalized: Readonly<MentorPoolQuery>
): string {
  if (normalized === UNFILTERED_MENTOR_POOL_QUERY) {
    return '';
  }

  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(normalized)) {
    if (typeof value === 'string' && value) {
      entries.push([key, value]);
    }
  }
  entries.sort(([keyA], [keyB]) => (keyA < keyB ? -1 : keyA > keyB ? 1 : 0));

  const canonicalParams = new URLSearchParams();
  for (const [key, value] of entries) {
    canonicalParams.set(key, value);
  }
  return canonicalParams.toString();
}

/**
 * Serializes a `MentorPoolQuery` into a deterministic canonical string key.
 * Unfiltered queries normalize to `''`; filtered queries serialize sorted
 * `snake_case` parameters via `URLSearchParams` so delimiters inside values
 * are percent-encoded and never collide across fields.
 */
export function serializeMentorPoolQuery(
  query?: MentorPoolQuery | null
): string {
  const normalized = normalizeMentorPoolQuery(query);
  return serializeCanonicalQueryEntries(normalized);
}

/**
 * Inverse of `serializeMentorPoolQuery`: reconstructs a frozen normalized
 * `MentorPoolQuery` (or `UNFILTERED_MENTOR_POOL_QUERY` when empty) from its
 * canonical serialized string key.
 */
export function deserializeMentorPoolQuery(
  serialized: string
): Readonly<MentorPoolQuery> {
  if (!serialized) {
    return UNFILTERED_MENTOR_POOL_QUERY;
  }

  const params = new URLSearchParams(serialized);
  const rawQuery: MentorPoolQuery = {
    search_pattern: params.get('search_pattern') ?? undefined,
    sort_by: normalizeSortBy(params.get('sort_by')),
  };
  for (const dim of MENTOR_POOL_FILTER_DIMENSIONS) {
    rawQuery[dim.key] = params.get(dim.key) ?? undefined;
  }
  return normalizeMentorPoolQuery(rawQuery);
}

/**
 * Counts deduplicated non-empty filter tokens across all declared
 * `MENTOR_POOL_FILTER_DIMENSIONS`.
 */
export function countActiveMentorPoolFilters(
  query?: MentorPoolQuery | null
): number {
  if (!query) return 0;
  let total = 0;
  for (const dim of MENTOR_POOL_FILTER_DIMENSIONS) {
    total += parseFilterTokens(query[dim.key]).length;
  }
  return total;
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
  for (const dim of MENTOR_POOL_FILTER_DIMENSIONS) {
    const value = normalized[dim.key];
    if (value) {
      request[dim.key] = value;
    }
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

function sanitizeTokenList(tokens: readonly string[]): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of tokens) {
    const trimmed = raw.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      cleaned.push(trimmed);
    }
  }
  return cleaned;
}

export function createFilterDraft(
  source?:
    SelectFilters | FilterDraft | SearchParamReader | string | null | undefined
): FilterDraft {
  if (!source) {
    return EMPTY_FILTER_DRAFT;
  }

  if (typeof source === 'string' || isSearchParamReader(source)) {
    const reader = toParamReader(source);
    if (!reader) return EMPTY_FILTER_DRAFT;
    const draft: Record<string, readonly string[]> = {};
    for (const dim of MENTOR_POOL_FILTER_DIMENSIONS) {
      const tokens = parseFilterTokens(reader.get(dim.key));
      if (tokens.length > 0) {
        draft[dim.key] = Object.freeze(tokens);
      }
    }
    return Object.keys(draft).length > 0
      ? Object.freeze(draft)
      : EMPTY_FILTER_DRAFT;
  }

  const draft: Record<string, readonly string[]> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (!entry) continue;
    const tokens = Array.isArray(entry)
      ? sanitizeTokenList(entry)
      : parseFilterTokens((entry as { value?: string }).value);
    if (tokens.length > 0) {
      draft[key] = Object.freeze(tokens);
    }
  }
  return Object.keys(draft).length > 0
    ? Object.freeze(draft)
    : EMPTY_FILTER_DRAFT;
}

export function setFilterDraftValue(
  draft: FilterDraft,
  key: string,
  value: string | readonly string[] | null | undefined
): FilterDraft {
  const tokens = Array.isArray(value)
    ? sanitizeTokenList(value)
    : parseFilterTokens(value as string | null | undefined);

  if (tokens.length === 0) {
    if (!(key in draft)) return draft;
    const next: Record<string, readonly string[]> = {};
    for (const [k, existing] of Object.entries(draft)) {
      if (k !== key) {
        next[k] = existing;
      }
    }
    return Object.keys(next).length > 0
      ? Object.freeze(next)
      : EMPTY_FILTER_DRAFT;
  }

  return Object.freeze({
    ...draft,
    [key]: Object.freeze(tokens),
  });
}

export function toggleFilterToken(
  draft: FilterDraft,
  key: string,
  token: string
): FilterDraft {
  const trimmed = token.trim();
  if (!trimmed) return draft;

  const current = draft[key] ?? [];
  const exists = current.includes(trimmed);
  const nextTokens = exists
    ? current.filter((item) => item !== trimmed)
    : [...current, trimmed];

  return setFilterDraftValue(draft, key, nextTokens);
}

export function clearFilterDraft(): FilterDraft {
  return EMPTY_FILTER_DRAFT;
}

export function draftToSelectFilters(
  draft: FilterDraft,
  filterOptions: FilterOptions = DEFAULT_MENTOR_FILTER_OPTIONS
): SelectFilters {
  const result: SelectFilters = {};
  for (const [key, tokens] of Object.entries(draft)) {
    const cleaned = sanitizeTokenList(tokens);
    if (cleaned.length > 0) {
      const name =
        filterOptions[key]?.name ??
        DEFAULT_MENTOR_FILTER_OPTIONS[key]?.name ??
        key;
      result[key] = {
        name,
        value: cleaned.join(','),
      };
    }
  }
  return result;
}

export function applyFilterDraftToParams(
  base: SearchParamInput | null | undefined,
  draftOrFilters: FilterDraft | SelectFilters
): URLSearchParams {
  const next = toURLSearchParams(base);
  Array.from(next.keys()).forEach((existingKey) => {
    if (existingKey.startsWith('filter_')) {
      next.delete(existingKey);
    }
  });

  const normalizedDraft = createFilterDraft(draftOrFilters);
  for (const [key, tokens] of Object.entries(normalizedDraft)) {
    if (tokens.length > 0) {
      next.set(key, tokens.join(','));
    }
  }
  return next;
}

export function buildFilterApplyAnalyticsAttrs(
  draftOrFilters: FilterDraft | SelectFilters | null | undefined
): FilterApplyAnalyticsAttrs {
  const normalizedDraft = createFilterDraft(draftOrFilters);
  const activeEntries = Object.entries(normalizedDraft).filter(
    ([, tokens]) => tokens.length > 0
  );
  const activeFilterTypes =
    activeEntries.length > 0
      ? activeEntries.map(([key]) => key).join(',')
      : 'none';
  const activeFilterValues =
    activeEntries.length > 0
      ? activeEntries.map(([, tokens]) => tokens.join(',')).join(',')
      : 'cleared';

  return {
    'data-analytics-click': 'mentor_pool_filter_apply',
    'data-analytics-event': 'mentor_pool_filter_apply',
    'data-analytics-feature': 'mentor_pool',
    'data-analytics-location': 'filter_dropdown',
    'data-analytics-param-filter-type': activeFilterTypes,
    'data-analytics-param-filter-value': activeFilterValues,
  };
}

export function setSelectedFiltersOnParams(
  base: SearchParamInput | null | undefined,
  filters: SelectFilters
): URLSearchParams {
  return applyFilterDraftToParams(base, filters);
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

function resolveDimensionOptions(
  dimension: MentorPoolFilterDimension,
  tagCatalog?: MentorFilterCatalogInput | null
): FilterOption[] {
  const source = dimension.optionSource;
  if (source.kind === 'static') {
    return [...source.options];
  }
  if (!tagCatalog) {
    return [];
  }
  if (source.kind === 'catalog_leaves') {
    const groups = tagCatalog[source.bucket];
    return groups ? subjectsToOptions(flattenLeaves(groups)) : [];
  }
  const flatItems = tagCatalog[source.bucket];
  return flatItems ? subjectsToOptions(flatItems) : [];
}

export function buildMentorFilterOptions(
  tagCatalog: MentorFilterCatalogInput,
  baseOptions: FilterOptions = DEFAULT_MENTOR_FILTER_OPTIONS,
  dimensions: ReadonlyArray<MentorPoolFilterDimension> = MENTOR_POOL_FILTER_DIMENSIONS
): FilterOptions {
  const next: FilterOptions = { ...baseOptions };
  for (const dim of dimensions) {
    const baseMeta = baseOptions[dim.key] ?? { name: dim.name, options: [] };
    next[dim.key] = {
      ...baseMeta,
      options: resolveDimensionOptions(dim, tagCatalog),
    };
  }
  return next;
}

export function resolvePrioritizedCardTagCodes(
  selectedFilters: SelectFilters | null | undefined,
  dimensions: ReadonlyArray<MentorPoolFilterDimension> = MENTOR_POOL_FILTER_DIMENSIONS
): ReadonlySet<string> {
  if (!selectedFilters) {
    return EMPTY_PRIORITIZED_CARD_TAG_CODES;
  }
  const codes = new Set<string>();
  for (const dim of dimensions) {
    if (!dim.prioritizeCardTags) continue;
    const entry = selectedFilters[dim.key];
    if (!entry?.value) continue;
    for (const token of parseFilterTokens(entry.value)) {
      codes.add(token);
    }
  }
  return codes.size > 0 ? codes : EMPTY_PRIORITIZED_CARD_TAG_CODES;
}

/**
 * Single-pass pure discovery projection from URL search params and tag catalog
 * across `MENTOR_POOL_FILTER_DIMENSIONS`. Computes canonical `query`,
 * `queryKey`, `selectedTokensByKey`, `selectedFilters`, `filterOptions`,
 * `activeBadges`, `prioritizedCardTagCodes`, and `hasConditions` without
 * re-parsing URL parameters or splitting localized badge strings.
 */
export function projectMentorPoolDiscoveryState(
  params: SearchParamReader | string | null | undefined,
  tagCatalog?: MentorFilterCatalogInput | null,
  options?: ProjectMentorPoolDiscoveryOptions
): MentorPoolDiscoveryProjection {
  const dimensions = options?.dimensions ?? MENTOR_POOL_FILTER_DIMENSIONS;
  const providedFilterOptions = options?.filterOptions;
  const reader = toParamReader(params);

  const searchQuery = reader?.get(SEARCH_PARAM_KEY)?.trim() ?? '';
  const sortBy = normalizeSortBy(reader?.get(SORT_BY_PARAM_KEY));

  const filterOptions: FilterOptions = providedFilterOptions
    ? { ...providedFilterOptions }
    : {};
  const selectedTokensRecord: Record<string, readonly string[]> = {};
  const selectedFilters: SelectFilters = {};
  const activeBadges: ActiveFilterBadge[] = [];
  const prioritizedSet = new Set<string>();
  const normalizedQueryDraft: MentorPoolQuery = {};
  let hasAnyCanonicalFilter = false;

  for (const dim of dimensions) {
    let dimMeta = providedFilterOptions?.[dim.key];
    if (!dimMeta) {
      dimMeta = {
        name: dim.name,
        options: resolveDimensionOptions(dim, tagCatalog),
      };
      filterOptions[dim.key] = dimMeta;
    } else if (tagCatalog) {
      dimMeta = {
        ...dimMeta,
        options: resolveDimensionOptions(dim, tagCatalog),
      };
      filterOptions[dim.key] = dimMeta;
    }

    const tokens = Object.freeze(parseFilterTokens(reader?.get(dim.key)));
    selectedTokensRecord[dim.key] = tokens;

    if (tokens.length === 0) {
      continue;
    }

    const canonicalVal = canonicalizeTokens(tokens);
    if (canonicalVal) {
      (normalizedQueryDraft as Record<string, string>)[dim.key] = canonicalVal;
      hasAnyCanonicalFilter = true;
    }

    selectedFilters[dim.key] = {
      name: dimMeta.name,
      value: tokens.join(','),
    };

    const labelByValue = new Map<string, string>();
    for (const opt of dimMeta.options) {
      labelByValue.set(opt.value, opt.label);
    }

    for (const token of tokens) {
      activeBadges.push({
        key: dim.key,
        name: dimMeta.name,
        value: token,
        label: labelByValue.get(token) ?? token,
      });
      if (dim.prioritizeCardTags) {
        prioritizedSet.add(token);
      }
    }
  }

  let query: Readonly<MentorPoolQuery>;
  if (!searchQuery && !hasAnyCanonicalFilter && !sortBy) {
    query = UNFILTERED_MENTOR_POOL_QUERY;
  } else {
    if (searchQuery) {
      normalizedQueryDraft.search_pattern = searchQuery;
    }
    if (sortBy) {
      normalizedQueryDraft.sort_by = sortBy;
    }
    query = markCanonicalQuery(normalizedQueryDraft);
  }

  const queryKey = serializeCanonicalQueryEntries(query);

  return {
    query,
    queryKey,
    searchQuery,
    selectedTokensByKey: Object.freeze(selectedTokensRecord) as Readonly<
      Record<MentorPoolFilterKey, readonly string[]>
    >,
    selectedFilters,
    filterOptions,
    activeBadges,
    prioritizedCardTagCodes:
      prioritizedSet.size > 0
        ? prioritizedSet
        : EMPTY_PRIORITIZED_CARD_TAG_CODES,
    hasConditions: query !== UNFILTERED_MENTOR_POOL_QUERY,
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
