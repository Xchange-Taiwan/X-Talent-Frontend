import {
  type AsyncPrimeOptions,
  AsyncReadManager,
  type AsyncReadOptions,
  type AsyncReadResult,
  type AsyncReadSource,
} from '@/lib/asyncReadManager';
import { getSafeErrorMessage, isAbortError } from '@/lib/errorUtils';
import type { MentorPage, MentorRequest, MentorType } from '@/types/mentor';

import {
  DEFAULT_MENTOR_PAGE_LIMIT,
  isUnfilteredMentorPoolQuery,
  type MentorPoolQuery,
  normalizeMentorPoolQuery,
  parseMentorPoolQuery,
  type SearchParamReader,
  toMentorRequest,
  UNFILTERED_MENTOR_POOL_QUERY,
} from './mentorPoolQuery';

export {
  DEFAULT_MENTOR_PAGE_LIMIT,
  isUnfilteredMentorPoolQuery,
  type MentorPoolQuery,
  normalizeMentorPoolQuery,
  parseMentorPoolQuery,
  type SearchParamReader,
  toMentorRequest,
  UNFILTERED_MENTOR_POOL_QUERY,
};

const UNFILTERED_MENTOR_POOL_KEY = '__unfiltered__';
const MAX_INTERNED_QUERIES = 256;

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

function toCacheKey(query?: MentorPoolQuery | null): string {
  const normalized = normalizeMentorPoolQuery(query);
  if (normalized === UNFILTERED_MENTOR_POOL_QUERY) {
    return UNFILTERED_MENTOR_POOL_KEY;
  }

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

export interface MentorPoolSSRSeed {
  initialMentors: MentorType[];
  initialNextCursor?: string | null;
  initialMentorCount: number;
  initialError?: boolean;
  hasInitialFilters?: boolean;
  initialQuery?: MentorPoolQuery | null;
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
  internQuery(query?: MentorPoolQuery | null): Readonly<MentorPoolQuery>;
  resolveQuery(
    params: SearchParamReader | string | null | undefined
  ): Readonly<MentorPoolQuery>;
  resolveSSRInitialData(
    query: MentorPoolQuery | null | undefined,
    seed: MentorPoolSSRSeed
  ): MentorPoolPageState | undefined;
  primeUnfilteredFromSSR(seed: MentorPoolSSRSeed): void;
  get(query: MentorPoolQuery): MentorPoolPageState | undefined;
  set(query: MentorPoolQuery, value: MentorPoolPageState, ttlMs?: number): void;
  prime(
    query: MentorPoolQuery,
    value: MentorPoolPageState,
    options?: AsyncPrimeOptions
  ): void;
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

function buildUnfilteredState({
  initialMentors,
  initialNextCursor = null,
  initialMentorCount,
  hasInitialFilters = false,
  initialError = false,
}: BuildInitialUnfilteredStateOptions): MentorPoolPageState {
  const nextCursor = initialNextCursor || null;
  return {
    mentors: initialMentors,
    nextCursor,
    hasMore: initialMentors.length > 0 && nextCursor !== null,
    mentorCount: initialMentorCount,
    isNoResults: initialMentors.length === 0,
    hasError: hasInitialFilters ? false : initialError,
  };
}

export function createMentorPoolReadModel(): MentorPoolReadModel {
  const manager = new AsyncReadManager<string, MentorPoolPageState>();
  const internedQueries = new Map<string, Readonly<MentorPoolQuery>>();
  const inflightLoadMore = new Map<string, InflightLoadMoreEntry>();
  const loadMoreListeners = new Map<
    string,
    Set<(result: AsyncReadResult<MentorPoolPageState>) => void>
  >();
  let transientUnfilteredError: MentorPoolPageState | null = null;
  let hasClientActivity = false;

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

  function internQuery(
    query?: MentorPoolQuery | null
  ): Readonly<MentorPoolQuery> {
    const normalized = normalizeMentorPoolQuery(query);
    if (normalized === UNFILTERED_MENTOR_POOL_QUERY) {
      return UNFILTERED_MENTOR_POOL_QUERY;
    }

    const cacheKey = toCacheKey(normalized);
    const existing = internedQueries.get(cacheKey);
    if (existing !== undefined) {
      return existing;
    }

    if (internedQueries.size >= MAX_INTERNED_QUERIES) {
      const oldestKey = internedQueries.keys().next().value;
      if (oldestKey !== undefined) {
        internedQueries.delete(oldestKey);
      }
    }

    internedQueries.set(cacheKey, normalized);
    return normalized;
  }

  return {
    internQuery,

    resolveQuery(params) {
      return internQuery(parseMentorPoolQuery(params));
    },

    resolveSSRInitialData(query, seed) {
      if (!isUnfilteredMentorPoolQuery(query)) {
        return undefined;
      }
      const hasInitialFilters =
        seed.hasInitialFilters ??
        (seed.initialQuery !== undefined
          ? !isUnfilteredMentorPoolQuery(seed.initialQuery)
          : false);
      if (seed.initialError) {
        if (
          hasInitialFilters ||
          hasClientActivity ||
          manager.has(UNFILTERED_MENTOR_POOL_KEY)
        ) {
          return undefined;
        }
        return buildUnfilteredState({
          initialMentors: seed.initialMentors,
          initialNextCursor: seed.initialNextCursor,
          initialMentorCount: seed.initialMentorCount,
          hasInitialFilters: false,
          initialError: true,
        });
      }
      if (seed.initialMentors.length > 0) {
        return buildUnfilteredState({
          initialMentors: seed.initialMentors,
          initialNextCursor: seed.initialNextCursor,
          initialMentorCount: seed.initialMentorCount,
          hasInitialFilters: false,
          initialError: false,
        });
      }
      return undefined;
    },

    primeUnfilteredFromSSR(seed) {
      const hasInitialFilters =
        seed.hasInitialFilters ??
        (seed.initialQuery !== undefined
          ? !isUnfilteredMentorPoolQuery(seed.initialQuery)
          : false);

      if (seed.initialError) {
        if (
          !hasInitialFilters &&
          !hasClientActivity &&
          !manager.has(UNFILTERED_MENTOR_POOL_KEY)
        ) {
          transientUnfilteredError = buildUnfilteredState({
            initialMentors: seed.initialMentors,
            initialNextCursor: seed.initialNextCursor,
            initialMentorCount: seed.initialMentorCount,
            hasInitialFilters: false,
            initialError: true,
          });
        }
        return;
      }

      if (seed.initialMentors.length === 0) {
        return;
      }

      transientUnfilteredError = null;
      manager.prime(
        UNFILTERED_MENTOR_POOL_KEY,
        buildUnfilteredState({
          initialMentors: seed.initialMentors,
          initialNextCursor: seed.initialNextCursor,
          initialMentorCount: seed.initialMentorCount,
          hasInitialFilters: false,
          initialError: false,
        }),
        { ifEmpty: true }
      );
    },

    get(query) {
      return manager.get(toCacheKey(query));
    },

    set(query, value, ttlMs) {
      const cacheKey = toCacheKey(query);
      hasClientActivity = true;
      transientUnfilteredError = null;
      cancelInflightLoadMore(cacheKey);
      manager.set(cacheKey, value, ttlMs);
    },

    prime(query, value, options) {
      if (value.hasError) {
        return;
      }
      const cacheKey = toCacheKey(query);
      if (cacheKey === UNFILTERED_MENTOR_POOL_KEY) {
        transientUnfilteredError = null;
      }
      manager.prime(cacheKey, value, options);
    },

    subscribe(query, fetcher, onUpdate, options) {
      const cacheKey = toCacheKey(query);
      if (options?.force) {
        hasClientActivity = true;
        if (cacheKey === UNFILTERED_MENTOR_POOL_KEY) {
          transientUnfilteredError = null;
        }
        cancelInflightLoadMore(cacheKey);
      }

      if (
        cacheKey === UNFILTERED_MENTOR_POOL_KEY &&
        transientUnfilteredError !== null &&
        !options?.force
      ) {
        const errorSnapshot = transientUnfilteredError;
        onUpdate({ data: errorSnapshot, isLoading: false, error: null });
        const unobserve = manager.observe(cacheKey, () => {
          const latest = manager.peek(cacheKey);
          if (latest !== undefined) {
            onUpdate({ data: latest, isLoading: false, error: null });
          }
        });
        return () => {
          transientUnfilteredError = null;
          unobserve();
        };
      }

      hasClientActivity = true;
      transientUnfilteredError = null;

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
      const cacheKey = toCacheKey(query);
      hasClientActivity = true;
      transientUnfilteredError = null;
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

    buildInitialUnfilteredState: buildUnfilteredState,

    clear() {
      const activeLoadMore = Array.from(inflightLoadMore.values());
      transientUnfilteredError = null;
      hasClientActivity = false;
      internedQueries.clear();
      inflightLoadMore.clear();
      loadMoreListeners.clear();
      activeLoadMore.forEach((entry) => entry.controller.abort());
      manager.clear();
    },
  };
}

export const mentorPoolReadModel: MentorPoolReadModel =
  createMentorPoolReadModel();
