import {
  AsyncReadManager,
  type AsyncReadOptions,
  type AsyncReadResult,
  type AsyncReadSource,
} from '@/lib/asyncReadManager';
import { getSafeErrorMessage, isAbortError } from '@/lib/errorUtils';
import type { MentorPage, MentorRequest, MentorType } from '@/types/mentor';

export const DEFAULT_MENTOR_PAGE_LIMIT = 9;
export const UNFILTERED_MENTOR_POOL_KEY = '__unfiltered__';

export interface SearchParamReader {
  get(name: string): string | null;
}

export interface MentorPoolQuery {
  search_pattern?: string;
  filter_skills?: string;
  filter_topics?: string;
  filter_industries?: string;
  sort_by?: 'recent' | 'popularity';
}

export const UNFILTERED_MENTOR_POOL_QUERY: Readonly<MentorPoolQuery> =
  Object.freeze({});

export type MentorPageFetcher = (
  request: MentorRequest,
  signal: AbortSignal
) => Promise<MentorPage>;

export interface MentorPoolPageState {
  mentors: MentorType[];
  nextCursor: string | null;
  hasMore: boolean;
  mentorCount: number;
  isNoResults: boolean;
  hasError: boolean;
}

export const EMPTY_MENTOR_POOL_STATE: MentorPoolPageState = {
  mentors: [],
  nextCursor: null,
  hasMore: true,
  mentorCount: 0,
  isNoResults: false,
  hasError: false,
};

export type MentorPageAction =
  | { type: 'replace'; page: MentorPage; totalCount?: number }
  | { type: 'append'; page: MentorPage };

export function applyMentorPage(
  state: MentorPoolPageState,
  action: MentorPageAction
): MentorPoolPageState {
  switch (action.type) {
    case 'replace': {
      const { page, totalCount } = action;
      const nextCursor = page.nextCursor || null;
      return {
        mentors: page.mentors,
        nextCursor,
        hasMore: page.mentors.length > 0 && nextCursor !== null,
        mentorCount: totalCount ?? page.mentors.length,
        isNoResults: page.mentors.length === 0,
        hasError: false,
      };
    }
    case 'append': {
      const { page } = action;
      const nextCursor = page.nextCursor || null;

      const newMentors = page.mentors.filter(
        (newMentor) =>
          !state.mentors.some(
            (prevMentor) => prevMentor.user_id === newMentor.user_id
          )
      );

      const hasValidNextCursor =
        nextCursor !== null && nextCursor !== state.nextCursor;
      const hasProgress = newMentors.length > 0 && hasValidNextCursor;

      return {
        mentors:
          newMentors.length === 0
            ? state.mentors
            : [...state.mentors, ...newMentors],
        nextCursor,
        hasMore: hasProgress,
        mentorCount: state.mentorCount + newMentors.length,
        isNoResults: false,
        hasError: false,
      };
    }
    default:
      return state;
  }
}

function normalizeFilterValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (!value.includes(',')) {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  const tokens = Array.from(
    new Set(
      value
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean)
    )
  ).sort();
  return tokens.length > 0 ? tokens.join(',') : undefined;
}

export function normalizeMentorPoolQuery(
  query?: MentorPoolQuery | null
): MentorPoolQuery {
  if (!query) {
    return UNFILTERED_MENTOR_POOL_QUERY;
  }

  const searchPattern = query.search_pattern ? query.search_pattern : undefined;
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
  return normalized;
}

export function parseMentorPoolQuery(
  params: SearchParamReader | string | null | undefined
): MentorPoolQuery {
  if (!params) {
    return UNFILTERED_MENTOR_POOL_QUERY;
  }
  const reader: SearchParamReader =
    typeof params === 'string' ? new URLSearchParams(params) : params;
  const rawSortBy = reader.get('sort_by');
  const sortBy =
    rawSortBy === 'recent' || rawSortBy === 'popularity'
      ? rawSortBy
      : undefined;

  return normalizeMentorPoolQuery({
    search_pattern: reader.get('q') ?? undefined,
    filter_skills: reader.get('filter_skills') ?? undefined,
    filter_topics: reader.get('filter_topics') ?? undefined,
    filter_industries: reader.get('filter_industries') ?? undefined,
    sort_by: sortBy,
  });
}

export function toMentorPoolCacheKey(query?: MentorPoolQuery | null): string {
  const normalized = normalizeMentorPoolQuery(query);
  const canonicalParams = new URLSearchParams();

  if (normalized.filter_industries) {
    canonicalParams.set('filter_industries', normalized.filter_industries);
  }
  if (normalized.filter_skills) {
    canonicalParams.set('filter_skills', normalized.filter_skills);
  }
  if (normalized.filter_topics) {
    canonicalParams.set('filter_topics', normalized.filter_topics);
  }
  if (normalized.search_pattern) {
    canonicalParams.set('search_pattern', normalized.search_pattern);
  }
  if (normalized.sort_by) {
    canonicalParams.set('sort_by', normalized.sort_by);
  }

  const serialized = canonicalParams.toString();
  return serialized ? serialized : UNFILTERED_MENTOR_POOL_KEY;
}

export function isUnfilteredMentorPoolQuery(
  query?: MentorPoolQuery | null
): boolean {
  return toMentorPoolCacheKey(query) === UNFILTERED_MENTOR_POOL_KEY;
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

export async function fetchMentorPoolPageOne(
  query: MentorPoolQuery,
  fetchPage: MentorPageFetcher,
  signal: AbortSignal,
  limit: number = DEFAULT_MENTOR_PAGE_LIMIT
): Promise<MentorPoolPageState> {
  const page = await fetchPage(toMentorRequest(query, { limit }), signal);
  return applyMentorPage(EMPTY_MENTOR_POOL_STATE, {
    type: 'replace',
    page,
  });
}

export interface BuildInitialUnfilteredStateOptions {
  initialMentors: MentorType[];
  initialNextCursor?: string | null;
  initialMentorCount: number;
  hasInitialFilters?: boolean;
  initialError?: boolean;
}

export interface LoadMoreMentorPoolOptions {
  fallbackState?: MentorPoolPageState;
  limit?: number;
}

export type LoadMoreMentorPoolResult =
  | {
      status: 'appended';
      data: MentorPoolPageState;
      deduplicated?: boolean;
    }
  | {
      status: 'noop';
      data: MentorPoolPageState | null;
      deduplicated?: boolean;
    }
  | {
      status: 'aborted';
      data: MentorPoolPageState | null;
      deduplicated?: boolean;
    }
  | {
      status: 'error';
      data: MentorPoolPageState | null;
      error: string;
      deduplicated?: boolean;
    };

export interface MentorPoolReadModel extends AsyncReadSource<
  MentorPoolQuery,
  MentorPoolPageState
> {
  get(query: MentorPoolQuery): MentorPoolPageState | undefined;
  set(query: MentorPoolQuery, value: MentorPoolPageState, ttlMs?: number): void;
  subscribe(
    query: MentorPoolQuery,
    fetcher: (
      signal: AbortSignal,
      context?: { force?: boolean }
    ) => Promise<MentorPoolPageState>,
    onUpdate: (result: AsyncReadResult<MentorPoolPageState>) => void,
    options?: AsyncReadOptions<MentorPoolPageState>
  ): () => void;
  loadMore(
    query: MentorPoolQuery,
    fetchPage: MentorPageFetcher,
    options?: LoadMoreMentorPoolOptions
  ): Promise<LoadMoreMentorPoolResult>;
  buildInitialUnfilteredState(
    opts: BuildInitialUnfilteredStateOptions
  ): MentorPoolPageState;
  clear(): void;
}

interface InflightLoadMoreEntry {
  promise: Promise<LoadMoreMentorPoolResult>;
  controller: AbortController;
}

export function createMentorPoolReadModel(): MentorPoolReadModel {
  const manager = new AsyncReadManager<string, MentorPoolPageState>();
  const inflightLoadMore = new Map<string, InflightLoadMoreEntry>();
  const loadMoreListeners = new Map<
    string,
    Set<(result: AsyncReadResult<MentorPoolPageState>) => void>
  >();

  function notifyLoadMoreListeners(
    cacheKey: string,
    result: AsyncReadResult<MentorPoolPageState>
  ): void {
    const listeners = loadMoreListeners.get(cacheKey);
    if (!listeners) return;
    Array.from(listeners).forEach((listener) => {
      if (listeners.has(listener)) {
        listener(result);
      }
    });
  }

  function cancelInflightLoadMore(cacheKey: string): void {
    const entry = inflightLoadMore.get(cacheKey);
    if (entry) {
      inflightLoadMore.delete(cacheKey);
      entry.controller.abort();
    }
  }

  return {
    get(query) {
      return manager.get(toMentorPoolCacheKey(query));
    },

    set(query, value, ttlMs) {
      const cacheKey = toMentorPoolCacheKey(query);
      cancelInflightLoadMore(cacheKey);
      manager.set(cacheKey, value, ttlMs);
    },

    subscribe(query, fetcher, onUpdate, options) {
      const cacheKey = toMentorPoolCacheKey(query);
      if (options?.force) {
        cancelInflightLoadMore(cacheKey);
      }

      let listenerSet = loadMoreListeners.get(cacheKey);
      if (!listenerSet) {
        listenerSet = new Set();
        loadMoreListeners.set(cacheKey, listenerSet);
      }
      listenerSet.add(onUpdate);

      const unsubscribe = manager.subscribe(
        cacheKey,
        fetcher,
        (result) => {
          if (inflightLoadMore.has(cacheKey)) {
            onUpdate({ ...result, isLoading: true });
          } else {
            onUpdate(result);
          }
        },
        options
      );

      return () => {
        const currentSet = loadMoreListeners.get(cacheKey);
        if (currentSet) {
          currentSet.delete(onUpdate);
          if (currentSet.size === 0) {
            loadMoreListeners.delete(cacheKey);
          }
        }
        unsubscribe();
        if (manager.getListenerCount(cacheKey) === 0) {
          cancelInflightLoadMore(cacheKey);
        }
      };
    },

    loadMore(query, fetchPage, options) {
      const cacheKey = toMentorPoolCacheKey(query);
      const existing = inflightLoadMore.get(cacheKey);
      if (existing && !existing.controller.signal.aborted) {
        return existing.promise.then((res) => ({
          ...res,
          deduplicated: true,
        }));
      }

      const baseState = manager.peek(cacheKey) ?? options?.fallbackState;
      if (!baseState || !baseState.hasMore || !baseState.nextCursor) {
        return Promise.resolve({
          status: 'noop',
          data: baseState ?? null,
        });
      }

      const controller = new AbortController();
      const entry: InflightLoadMoreEntry = {
        controller,
        promise: Promise.resolve({ status: 'aborted', data: null }),
      };
      inflightLoadMore.set(cacheKey, entry);

      const request = toMentorRequest(query, {
        limit: options?.limit,
        cursor: baseState.nextCursor,
      });

      let rawPromise: Promise<MentorPage>;
      try {
        rawPromise = Promise.resolve(fetchPage(request, controller.signal));
      } catch (syncErr) {
        rawPromise = Promise.reject(syncErr);
      }

      const promise = rawPromise.then(
        (page): LoadMoreMentorPoolResult => {
          const wasActiveInflight =
            inflightLoadMore.get(cacheKey)?.controller === controller;
          if (wasActiveInflight) {
            inflightLoadMore.delete(cacheKey);
          }

          if (controller.signal.aborted) {
            const latest = manager.peek(cacheKey) ?? null;
            return { status: 'aborted', data: latest };
          }

          const currentBase = manager.peek(cacheKey) ?? baseState;
          const nextState = applyMentorPage(currentBase, {
            type: 'append',
            page,
          });
          manager.set(cacheKey, nextState);
          return { status: 'appended', data: nextState };
        },
        (err): LoadMoreMentorPoolResult => {
          const wasActiveInflight =
            inflightLoadMore.get(cacheKey)?.controller === controller;
          if (wasActiveInflight) {
            inflightLoadMore.delete(cacheKey);
          }

          if (
            controller.signal.aborted ||
            isAbortError(err, controller.signal)
          ) {
            const latest = manager.peek(cacheKey) ?? baseState;
            if (wasActiveInflight) {
              notifyLoadMoreListeners(cacheKey, {
                data: latest,
                isLoading: false,
                error: null,
              });
            }
            return { status: 'aborted', data: latest };
          }

          const latest = manager.peek(cacheKey) ?? baseState;
          const message = getSafeErrorMessage(err);

          if (latest.mentors.length === 0) {
            const errorState: MentorPoolPageState = {
              ...latest,
              hasError: true,
            };
            if (manager.peek(cacheKey) !== undefined) {
              manager.set(cacheKey, errorState);
            } else {
              notifyLoadMoreListeners(cacheKey, {
                data: errorState,
                isLoading: false,
                error: null,
              });
            }
            return { status: 'error', data: errorState, error: message };
          }

          notifyLoadMoreListeners(cacheKey, {
            data: latest,
            isLoading: false,
            error: null,
          });
          return { status: 'error', data: latest, error: message };
        }
      );

      entry.promise = promise;
      if (
        inflightLoadMore.get(cacheKey) === entry &&
        !controller.signal.aborted
      ) {
        notifyLoadMoreListeners(cacheKey, {
          data: baseState,
          isLoading: true,
          error: null,
        });
      }

      return promise;
    },

    buildInitialUnfilteredState({
      initialMentors,
      initialNextCursor = null,
      initialMentorCount,
      hasInitialFilters = false,
      initialError = false,
    }) {
      const nextCursor = initialNextCursor || null;
      return {
        mentors: initialMentors,
        nextCursor,
        hasMore: initialMentors.length > 0 && nextCursor !== null,
        mentorCount: initialMentorCount,
        isNoResults: initialMentors.length === 0,
        hasError: hasInitialFilters ? false : initialError,
      };
    },

    clear() {
      const activeLoadMore = Array.from(inflightLoadMore.values());
      inflightLoadMore.clear();
      loadMoreListeners.clear();
      activeLoadMore.forEach((entry) => entry.controller.abort());
      manager.clear();
    },
  };
}

export const mentorPoolReadModel: MentorPoolReadModel =
  createMentorPoolReadModel();
