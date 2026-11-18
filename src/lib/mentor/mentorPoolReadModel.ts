import type {
  AsyncPrimeOptions,
  AsyncReadOptions,
  AsyncReadResult,
} from '@/lib/asyncReadManager';
import { getSafeErrorMessage, isAbortError } from '@/lib/errorUtils';
import { fetchMentors } from '@/services/search-mentor/mentors';
import type { MentorPage, MentorRequest, MentorType } from '@/types/mentor';

import {
  countActiveMentorPoolFilters,
  DEFAULT_MENTOR_PAGE_LIMIT,
  deserializeMentorPoolQuery,
  isUnfilteredMentorPoolQuery,
  type MentorPoolQuery,
  normalizeMentorPoolQuery,
  parseMentorPoolQuery,
  type SearchParamReader,
  serializeMentorPoolQuery,
  toMentorRequest,
  UNFILTERED_MENTOR_POOL_QUERY,
} from './mentorPoolQuery';

export {
  countActiveMentorPoolFilters,
  DEFAULT_MENTOR_PAGE_LIMIT,
  deserializeMentorPoolQuery,
  isUnfilteredMentorPoolQuery,
  type MentorPoolQuery,
  normalizeMentorPoolQuery,
  parseMentorPoolQuery,
  type SearchParamReader,
  serializeMentorPoolQuery,
  toMentorRequest,
  UNFILTERED_MENTOR_POOL_QUERY,
};

const UNFILTERED_QUERY_KEY = '';

export type MentorPageFetcher = (
  request: MentorRequest,
  signal: AbortSignal
) => Promise<MentorPage>;

export interface MentorPoolTransport {
  fetchMentors: MentorPageFetcher;
}

export interface CreateMentorPoolReadModelOptions {
  transport?: MentorPoolTransport;
  defaultLimit?: number;
}

export type MentorPoolListStatus = 'loading' | 'error' | 'empty' | 'success';

export interface MentorPoolPageState {
  mentors: MentorType[];
  nextCursor: string | null;
  hasMore: boolean;
  mentorCount: number;
  isNoResults: boolean;
  hasError: boolean;
}

export interface MentorPoolSnapshot extends MentorPoolPageState {
  isLoading: boolean;
  listStatus: MentorPoolListStatus;
}

export const EMPTY_MENTOR_POOL_STATE: MentorPoolPageState = {
  mentors: [],
  nextCursor: null,
  hasMore: true,
  mentorCount: 0,
  isNoResults: false,
  hasError: false,
};

const ERROR_MENTOR_POOL_STATE: Readonly<MentorPoolPageState> = Object.freeze({
  mentors: [],
  nextCursor: null,
  hasMore: false,
  mentorCount: 0,
  isNoResults: false,
  hasError: true,
});

const LOADING_MENTOR_POOL_SNAPSHOT: Readonly<MentorPoolSnapshot> =
  Object.freeze({
    mentors: [],
    nextCursor: null,
    hasMore: false,
    mentorCount: 0,
    isNoResults: false,
    hasError: false,
    isLoading: true,
    listStatus: 'loading',
  });

const SSR_EMPTY_ERROR_SNAPSHOT: Readonly<MentorPoolSnapshot> = Object.freeze({
  mentors: [],
  nextCursor: null,
  hasMore: false,
  mentorCount: 0,
  isNoResults: true,
  hasError: true,
  isLoading: false,
  listStatus: 'error',
});

export function deriveMentorPoolListStatus(
  state: Pick<MentorPoolPageState, 'mentors' | 'hasError' | 'isNoResults'>,
  isLoading: boolean
): MentorPoolListStatus {
  if (state.mentors.length > 0) return 'success';
  if (isLoading && !state.hasError) return 'loading';
  if (state.hasError) return 'error';
  if (state.isNoResults) return 'empty';
  return 'loading';
}

function toSnapshot(
  state: MentorPoolPageState,
  isLoading: boolean
): Readonly<MentorPoolSnapshot> {
  return Object.freeze({
    mentors: state.mentors,
    nextCursor: state.nextCursor,
    hasMore: state.hasMore,
    mentorCount: state.mentorCount,
    isNoResults: state.isNoResults,
    hasError: state.hasError,
    isLoading,
    listStatus: deriveMentorPoolListStatus(state, isLoading),
  });
}

function areSnapshotsEqual(
  a: MentorPoolSnapshot,
  b: MentorPoolSnapshot
): boolean {
  return (
    a.mentors === b.mentors &&
    a.nextCursor === b.nextCursor &&
    a.hasMore === b.hasMore &&
    a.mentorCount === b.mentorCount &&
    a.isNoResults === b.isNoResults &&
    a.hasError === b.hasError &&
    a.isLoading === b.isLoading &&
    a.listStatus === b.listStatus
  );
}

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

export interface MentorPoolSubscribeOptions {
  ssrSeed?: MentorPoolSSRSeed;
  limit?: number;
  force?: boolean;
  onError?: (error: unknown) => void;
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

export interface MentorPoolReadModel {
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
  subscribeSnapshot(
    query: MentorPoolQuery,
    onStoreChange: () => void,
    options?: MentorPoolSubscribeOptions
  ): () => void;
  getSnapshot(
    query: MentorPoolQuery,
    ssrSeed?: MentorPoolSSRSeed
  ): MentorPoolSnapshot;
  getServerSnapshot(
    query: MentorPoolQuery,
    ssrSeed?: MentorPoolSSRSeed
  ): MentorPoolSnapshot;
  retry(
    query: MentorPoolQuery,
    options?: { limit?: number }
  ): Promise<MentorPoolPageState | null>;
  loadMore(
    query: MentorPoolQuery,
    fetchPage: MentorPageFetcher,
    options?: LoadMoreMentorPoolOptions
  ): Promise<LoadMoreMentorPoolResult>;
  loadMore(
    query: MentorPoolQuery,
    options?: LoadMoreMentorPoolOptions
  ): Promise<LoadMoreMentorPoolResult>;
  buildInitialUnfilteredState(
    opts: BuildInitialUnfilteredStateOptions
  ): MentorPoolPageState;
  clear(): void;
}

interface InflightPageOne {
  controller: AbortController;
  promise: Promise<MentorPoolPageState | null>;
}

interface InflightLoadMore {
  controller: AbortController;
  promise: Promise<LoadMoreMentorPoolResult>;
}

type SlotPageOneFetcher = (
  signal: AbortSignal,
  context?: { force?: boolean }
) => Promise<MentorPoolPageState>;

interface SlotSubscriber {
  onStoreChange?: () => void;
  onResult?: (result: AsyncReadResult<MentorPoolPageState>) => void;
  onPageOneError?: (error: unknown) => void;
  pageOneFetcher?: SlotPageOneFetcher;
  pageOneOptions?: AsyncReadOptions<MentorPoolPageState>;
  retainsInflight: boolean;
  holdsTransientSsrError?: boolean;
}

interface QuerySlot {
  cachedState?: MentorPoolPageState;
  isSeededFromSSR?: boolean;
  expiresAt?: number;
  ephemeralErrorState?: MentorPoolPageState;
  inflightPageOne?: InflightPageOne;
  inflightLoadMore?: InflightLoadMore;
  subscribers: Set<SlotSubscriber>;
  snapshot: Readonly<MentorPoolSnapshot>;
}

interface MemoizedSsrSnapshotEntry {
  nextCursor: string | null;
  mentorCount: number;
  hasError: boolean;
  snapshot: Readonly<MentorPoolSnapshot>;
}

const defaultTransport: MentorPoolTransport = {
  fetchMentors: (request, signal) => fetchMentors(request, signal),
};

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

function areMentorsEquivalent(
  a: readonly MentorType[],
  b: readonly MentorType[]
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i] && JSON.stringify(a[i]) !== JSON.stringify(b[i])) {
      return false;
    }
  }
  return true;
}

export function createMentorPoolReadModel(
  modelOptions: CreateMentorPoolReadModelOptions = {}
): MentorPoolReadModel {
  const transport = modelOptions.transport ?? defaultTransport;
  const defaultLimit = modelOptions.defaultLimit ?? DEFAULT_MENTOR_PAGE_LIMIT;

  const slots = new Map<string, QuerySlot>();
  const ssrSnapshotMemo = new WeakMap<
    readonly MentorType[],
    MemoizedSsrSnapshotEntry
  >();
  let transientUnfilteredError: MentorPoolPageState | null = null;
  let transientUnfilteredSnapshot: Readonly<MentorPoolSnapshot> | null = null;
  let hasClientActivity = false;
  let isClearing = false;

  function isSlotFresh(slot: QuerySlot | undefined): boolean {
    if (!slot || slot.cachedState === undefined) return false;
    if (slot.expiresAt === undefined) return true;
    return Date.now() < slot.expiresAt;
  }

  function computeSlotSnapshot(
    queryKey: string,
    slot: QuerySlot
  ): Readonly<MentorPoolSnapshot> {
    const isLoading = Boolean(slot.inflightPageOne || slot.inflightLoadMore);

    if (
      queryKey === UNFILTERED_QUERY_KEY &&
      transientUnfilteredSnapshot !== null &&
      slot.cachedState === undefined &&
      !isLoading
    ) {
      return transientUnfilteredSnapshot;
    }

    if (isLoading) {
      if (slot.cachedState !== undefined) {
        return toSnapshot(slot.cachedState, true);
      }
      return LOADING_MENTOR_POOL_SNAPSHOT;
    }

    if (slot.cachedState !== undefined) {
      return toSnapshot(slot.cachedState, false);
    }

    if (slot.ephemeralErrorState !== undefined) {
      return toSnapshot(slot.ephemeralErrorState, false);
    }

    return LOADING_MENTOR_POOL_SNAPSHOT;
  }

  function getOrCreateSlot(queryKey: string): QuerySlot {
    const existing = slots.get(queryKey);
    if (existing) return existing;

    const created: QuerySlot = {
      subscribers: new Set(),
      snapshot: LOADING_MENTOR_POOL_SNAPSHOT,
    };
    created.snapshot = computeSlotSnapshot(queryKey, created);
    slots.set(queryKey, created);
    return created;
  }

  function syncSlotSnapshot(queryKey: string, slot: QuerySlot): boolean {
    const next = computeSlotSnapshot(queryKey, slot);
    if (areSnapshotsEqual(slot.snapshot, next)) {
      return false;
    }
    slot.snapshot = next;
    return true;
  }

  function hasRetainingSubscriber(slot: QuerySlot): boolean {
    return Array.from(slot.subscribers).some((sub) => sub.retainsInflight);
  }

  function hasTransientSsrHolder(slot: QuerySlot): boolean {
    return Array.from(slot.subscribers).some(
      (sub) => sub.holdsTransientSsrError
    );
  }

  function notifyStoreSubscribers(slot: QuerySlot): void {
    Array.from(slot.subscribers).forEach((sub) => {
      if (slot.subscribers.has(sub) && sub.onStoreChange) {
        sub.onStoreChange();
      }
    });
  }

  function notifyResultSubscribers(
    slot: QuerySlot,
    result: AsyncReadResult<MentorPoolPageState>
  ): void {
    Array.from(slot.subscribers).forEach((sub) => {
      if (slot.subscribers.has(sub) && sub.onResult) {
        sub.onResult(result);
      }
    });
  }

  function notifyPageOneErrorSubscribers(slot: QuerySlot, err: unknown): void {
    Array.from(slot.subscribers).forEach((sub) => {
      if (slot.subscribers.has(sub) && sub.onPageOneError) {
        sub.onPageOneError(err);
      }
    });
  }

  function cancelInflightPageOne(slot: QuerySlot): void {
    const inflight = slot.inflightPageOne;
    if (inflight) {
      slot.inflightPageOne = undefined;
      inflight.controller.abort();
    }
  }

  function cancelInflightLoadMore(slot: QuerySlot): void {
    const inflight = slot.inflightLoadMore;
    if (inflight) {
      slot.inflightLoadMore = undefined;
      inflight.controller.abort();
    }
  }

  function promoteTransientSsrSubscribers(
    slot: QuerySlot | undefined
  ): boolean {
    if (!slot) return false;
    let promoted = false;
    slot.subscribers.forEach((sub) => {
      if (sub.holdsTransientSsrError) {
        sub.holdsTransientSsrError = false;
        sub.retainsInflight = true;
        promoted = true;
      }
    });
    return promoted;
  }

  function clearTransientUnfilteredError(): boolean {
    const unfilteredSlot = slots.get(UNFILTERED_QUERY_KEY);
    const promoted = promoteTransientSsrSubscribers(unfilteredSlot);
    if (
      transientUnfilteredError === null &&
      transientUnfilteredSnapshot === null
    ) {
      return promoted;
    }
    transientUnfilteredError = null;
    transientUnfilteredSnapshot = null;
    if (
      unfilteredSlot &&
      syncSlotSnapshot(UNFILTERED_QUERY_KEY, unfilteredSlot)
    ) {
      notifyStoreSubscribers(unfilteredSlot);
    }
    return promoted;
  }

  function writeSlotState(
    queryKey: string,
    value: MentorPoolPageState,
    ttlMs?: number,
    isSeededFromSSR = false
  ): void {
    const slot = getOrCreateSlot(queryKey);
    cancelInflightPageOne(slot);
    cancelInflightLoadMore(slot);
    slot.cachedState = value;
    slot.isSeededFromSSR = isSeededFromSSR;
    slot.ephemeralErrorState = undefined;
    slot.expiresAt = ttlMs !== undefined ? Date.now() + ttlMs : undefined;
    syncSlotSnapshot(queryKey, slot);
    notifyStoreSubscribers(slot);
    notifyResultSubscribers(slot, {
      data: value,
      isLoading: false,
      error: null,
    });
  }

  function resolveSSRInitialData(
    query: MentorPoolQuery | null | undefined,
    seed: MentorPoolSSRSeed
  ): MentorPoolPageState | undefined {
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
        isSlotFresh(slots.get(UNFILTERED_QUERY_KEY))
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
  }

  function resolveMemoizedSSRSnapshot(
    query: MentorPoolQuery,
    ssrSeed?: MentorPoolSSRSeed
  ): Readonly<MentorPoolSnapshot> {
    if (!ssrSeed) {
      return LOADING_MENTOR_POOL_SNAPSHOT;
    }
    const ssrData = resolveSSRInitialData(query, ssrSeed);
    if (!ssrData) {
      return LOADING_MENTOR_POOL_SNAPSHOT;
    }
    if (
      ssrData.hasError &&
      ssrData.mentors.length === 0 &&
      ssrData.nextCursor === null &&
      ssrData.mentorCount === 0
    ) {
      return SSR_EMPTY_ERROR_SNAPSHOT;
    }

    const existing = ssrSnapshotMemo.get(ssrSeed.initialMentors);
    if (
      existing &&
      existing.nextCursor === ssrData.nextCursor &&
      existing.mentorCount === ssrData.mentorCount &&
      existing.hasError === ssrData.hasError
    ) {
      return existing.snapshot;
    }

    const snapshot = toSnapshot(ssrData, false);
    ssrSnapshotMemo.set(ssrSeed.initialMentors, {
      nextCursor: ssrData.nextCursor,
      mentorCount: ssrData.mentorCount,
      hasError: ssrData.hasError,
      snapshot,
    });
    return snapshot;
  }

  function primeUnfilteredFromSSR(seed: MentorPoolSSRSeed): void {
    const hasInitialFilters =
      seed.hasInitialFilters ??
      (seed.initialQuery !== undefined
        ? !isUnfilteredMentorPoolQuery(seed.initialQuery)
        : false);

    if (seed.initialError) {
      if (
        !hasInitialFilters &&
        !hasClientActivity &&
        !isSlotFresh(slots.get(UNFILTERED_QUERY_KEY))
      ) {
        const normalizedSeedCursor = seed.initialNextCursor || null;
        if (
          transientUnfilteredError !== null &&
          areMentorsEquivalent(
            transientUnfilteredError.mentors,
            seed.initialMentors
          ) &&
          transientUnfilteredError.nextCursor === normalizedSeedCursor &&
          transientUnfilteredError.mentorCount === seed.initialMentorCount &&
          transientUnfilteredError.hasError
        ) {
          return;
        }
        const errState = buildUnfilteredState({
          initialMentors: seed.initialMentors,
          initialNextCursor: seed.initialNextCursor,
          initialMentorCount: seed.initialMentorCount,
          hasInitialFilters: false,
          initialError: true,
        });
        transientUnfilteredError = errState;
        transientUnfilteredSnapshot =
          errState.mentors.length === 0 &&
          errState.nextCursor === null &&
          errState.mentorCount === 0
            ? SSR_EMPTY_ERROR_SNAPSHOT
            : toSnapshot(errState, false);
        const existingSlot = slots.get(UNFILTERED_QUERY_KEY);
        if (
          existingSlot &&
          syncSlotSnapshot(UNFILTERED_QUERY_KEY, existingSlot)
        ) {
          notifyStoreSubscribers(existingSlot);
        }
      }
      return;
    }

    const promoted = clearTransientUnfilteredError();
    if (seed.initialMentors.length === 0) {
      const unfilteredSlot = slots.get(UNFILTERED_QUERY_KEY);
      if (
        promoted &&
        unfilteredSlot &&
        !isSlotFresh(unfilteredSlot) &&
        !unfilteredSlot.inflightPageOne
      ) {
        hasClientActivity = true;
        const fetcherSub = Array.from(unfilteredSlot.subscribers).find(
          (sub) => sub.retainsInflight && sub.pageOneFetcher !== undefined
        );
        if (fetcherSub?.pageOneFetcher) {
          void launchPageOne(
            UNFILTERED_QUERY_KEY,
            unfilteredSlot,
            fetcherSub.pageOneFetcher,
            fetcherSub.pageOneOptions
          );
        }
      }
      return;
    }

    const existingSlot = slots.get(UNFILTERED_QUERY_KEY);
    if (isSlotFresh(existingSlot)) {
      if (!existingSlot?.isSeededFromSSR) {
        return;
      }
      const normalizedSeedCursor = seed.initialNextCursor || null;
      const current = existingSlot.cachedState!;
      if (
        areMentorsEquivalent(current.mentors, seed.initialMentors) &&
        current.nextCursor === normalizedSeedCursor &&
        current.mentorCount === seed.initialMentorCount &&
        !current.hasError
      ) {
        return;
      }
    }

    writeSlotState(
      UNFILTERED_QUERY_KEY,
      buildUnfilteredState({
        initialMentors: seed.initialMentors,
        initialNextCursor: seed.initialNextCursor,
        initialMentorCount: seed.initialMentorCount,
        hasInitialFilters: false,
        initialError: false,
      }),
      undefined,
      true
    );
  }

  function launchPageOne(
    queryKey: string,
    slot: QuerySlot,
    fetcher: (
      signal: AbortSignal,
      context?: { force?: boolean }
    ) => Promise<MentorPoolPageState>,
    options?: AsyncReadOptions<MentorPoolPageState> & { imperative?: boolean }
  ): Promise<MentorPoolPageState | null> {
    const force = Boolean(options?.force);
    if (force) {
      cancelInflightPageOne(slot);
      cancelInflightLoadMore(slot);
    }

    slot.ephemeralErrorState = undefined;
    if (slot.inflightPageOne) {
      if (syncSlotSnapshot(queryKey, slot)) {
        notifyStoreSubscribers(slot);
      }
      return slot.inflightPageOne.promise;
    }

    const controller = new AbortController();
    const inflightEntry: InflightPageOne = {
      controller,
      promise: Promise.resolve(null),
    };
    slot.inflightPageOne = inflightEntry;
    if (syncSlotSnapshot(queryKey, slot)) {
      notifyStoreSubscribers(slot);
    }

    let rawPromise: Promise<MentorPoolPageState>;
    try {
      rawPromise = Promise.resolve(fetcher(controller.signal, { force }));
    } catch (syncErr) {
      rawPromise = Promise.reject(syncErr);
    }

    const promise = rawPromise.then(
      (pageState): MentorPoolPageState | null => {
        if (slot.inflightPageOne?.controller === controller) {
          slot.inflightPageOne = undefined;
        }
        if (controller.signal.aborted) {
          if (syncSlotSnapshot(queryKey, slot)) {
            notifyStoreSubscribers(slot);
          }
          return null;
        }
        if (!options?.shouldCache || options.shouldCache(pageState)) {
          slot.cachedState = pageState;
          slot.isSeededFromSSR = false;
          slot.expiresAt =
            options?.ttlMs !== undefined
              ? Date.now() + options.ttlMs
              : undefined;
        }
        slot.ephemeralErrorState = undefined;
        syncSlotSnapshot(queryKey, slot);
        notifyStoreSubscribers(slot);
        notifyResultSubscribers(slot, {
          data: pageState,
          isLoading: false,
          error: null,
        });
        return pageState;
      },
      (err: unknown): MentorPoolPageState | null => {
        if (slot.inflightPageOne?.controller === controller) {
          slot.inflightPageOne = undefined;
        }
        if (controller.signal.aborted) {
          if (syncSlotSnapshot(queryKey, slot)) {
            notifyStoreSubscribers(slot);
          }
          return null;
        }

        const abortedOrTimeout = isAbortError(err, controller.signal);
        const message = getSafeErrorMessage(err);
        const fallbackData =
          slot.cachedState !== undefined
            ? slot.cachedState
            : options?.initialData !== undefined
              ? options.initialData
              : null;

        if (slot.cachedState === undefined) {
          slot.ephemeralErrorState = ERROR_MENTOR_POOL_STATE;
        }

        syncSlotSnapshot(queryKey, slot);
        if (!abortedOrTimeout) {
          notifyPageOneErrorSubscribers(slot, err);
        }
        notifyStoreSubscribers(slot);
        notifyResultSubscribers(slot, {
          data: fallbackData,
          isLoading: false,
          error: message,
        });
        return null;
      }
    );

    inflightEntry.promise = promise;
    if (controller.signal.aborted && slot.inflightPageOne === inflightEntry) {
      slot.inflightPageOne = undefined;
      syncSlotSnapshot(queryKey, slot);
    }

    return promise;
  }

  function detachSubscriber(
    queryKey: string,
    slot: QuerySlot,
    sub: SlotSubscriber
  ): void {
    slot.subscribers.delete(sub);

    if (
      queryKey === UNFILTERED_QUERY_KEY &&
      sub.holdsTransientSsrError &&
      !hasTransientSsrHolder(slot)
    ) {
      clearTransientUnfilteredError();
    }

    if (!hasRetainingSubscriber(slot)) {
      cancelInflightPageOne(slot);
      cancelInflightLoadMore(slot);
      slot.ephemeralErrorState = undefined;
      syncSlotSnapshot(queryKey, slot);
      if (slot.subscribers.size === 0 && slot.cachedState === undefined) {
        slots.delete(queryKey);
      }
    }
  }

  function executeLoadMore(
    query: MentorPoolQuery,
    fetchPage: MentorPageFetcher,
    options?: LoadMoreMentorPoolOptions
  ): Promise<LoadMoreMentorPoolResult> {
    const normalizedQuery = normalizeMentorPoolQuery(query);
    const queryKey = serializeMentorPoolQuery(normalizedQuery);
    hasClientActivity = true;
    clearTransientUnfilteredError();

    const slot = getOrCreateSlot(queryKey);
    const existing = slot.inflightLoadMore;
    if (existing && !existing.controller.signal.aborted) {
      return existing.promise.then((res) => ({
        ...res,
        deduplicated: true,
      }));
    }

    const baseState = slot.cachedState ?? options?.fallbackState;
    if (!baseState || !baseState.hasMore || !baseState.nextCursor) {
      return Promise.resolve({
        status: 'noop',
        data: baseState ?? null,
      });
    }

    const controller = new AbortController();
    const entry: InflightLoadMore = {
      controller,
      promise: Promise.resolve({ status: 'aborted', data: null }),
    };
    slot.inflightLoadMore = entry;

    const request = toMentorRequest(normalizedQuery, {
      limit: options?.limit ?? defaultLimit,
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
          slot.inflightLoadMore?.controller === controller;
        if (wasActiveInflight) {
          slot.inflightLoadMore = undefined;
        }

        if (controller.signal.aborted) {
          syncSlotSnapshot(queryKey, slot);
          return { status: 'aborted', data: slot.cachedState ?? null };
        }

        const currentBase = slot.cachedState ?? baseState;
        const nextState = applyMentorPage(currentBase, {
          type: 'append',
          page,
        });
        slot.cachedState = nextState;
        slot.isSeededFromSSR = false;
        slot.ephemeralErrorState = undefined;
        slot.expiresAt = undefined;
        syncSlotSnapshot(queryKey, slot);
        notifyStoreSubscribers(slot);
        notifyResultSubscribers(slot, {
          data: nextState,
          isLoading: false,
          error: null,
        });
        return { status: 'appended', data: nextState };
      },
      (err: unknown): LoadMoreMentorPoolResult => {
        const wasActiveInflight =
          slot.inflightLoadMore?.controller === controller;
        if (wasActiveInflight) {
          slot.inflightLoadMore = undefined;
        }

        if (controller.signal.aborted || isAbortError(err, controller.signal)) {
          const latest = slot.cachedState ?? baseState;
          syncSlotSnapshot(queryKey, slot);
          if (wasActiveInflight) {
            notifyStoreSubscribers(slot);
            notifyResultSubscribers(slot, {
              data: latest,
              isLoading: false,
              error: null,
            });
          }
          return { status: 'aborted', data: latest };
        }

        const latest = slot.cachedState ?? baseState;
        const message = getSafeErrorMessage(err);

        if (latest.mentors.length === 0) {
          const errorState: MentorPoolPageState = {
            ...latest,
            hasError: true,
          };
          if (slot.cachedState !== undefined) {
            slot.cachedState = errorState;
            slot.isSeededFromSSR = false;
          } else {
            slot.ephemeralErrorState = errorState;
          }
          syncSlotSnapshot(queryKey, slot);
          notifyStoreSubscribers(slot);
          notifyResultSubscribers(slot, {
            data: errorState,
            isLoading: false,
            error: null,
          });
          return { status: 'error', data: errorState, error: message };
        }

        syncSlotSnapshot(queryKey, slot);
        notifyStoreSubscribers(slot);
        notifyResultSubscribers(slot, {
          data: latest,
          isLoading: false,
          error: null,
        });
        return { status: 'error', data: latest, error: message };
      }
    );

    entry.promise = promise;
    if (slot.inflightLoadMore === entry && !controller.signal.aborted) {
      syncSlotSnapshot(queryKey, slot);
      notifyStoreSubscribers(slot);
      notifyResultSubscribers(slot, {
        data: baseState,
        isLoading: true,
        error: null,
      });
    }

    return promise;
  }

  return {
    resolveQuery(params) {
      return parseMentorPoolQuery(params);
    },

    resolveSSRInitialData,

    primeUnfilteredFromSSR,

    get(query) {
      const slot = slots.get(serializeMentorPoolQuery(query));
      return isSlotFresh(slot) ? slot?.cachedState : undefined;
    },

    set(query, value, ttlMs) {
      const queryKey = serializeMentorPoolQuery(query);
      hasClientActivity = true;
      clearTransientUnfilteredError();
      writeSlotState(queryKey, value, ttlMs);
    },

    prime(query, value, options) {
      if (options?.ifEmpty && value.hasError) {
        return;
      }
      const queryKey = serializeMentorPoolQuery(query);
      if (options?.ifEmpty && isSlotFresh(slots.get(queryKey))) {
        return;
      }
      if (queryKey === UNFILTERED_QUERY_KEY) {
        clearTransientUnfilteredError();
      }
      writeSlotState(queryKey, value, options?.ttlMs);
    },

    subscribe(query, fetcher, onUpdate, options) {
      const queryKey = serializeMentorPoolQuery(query);
      const slot = getOrCreateSlot(queryKey);

      if (options?.force) {
        hasClientActivity = true;
        if (queryKey === UNFILTERED_QUERY_KEY) {
          clearTransientUnfilteredError();
        }
        cancelInflightLoadMore(slot);
      }

      if (
        queryKey === UNFILTERED_QUERY_KEY &&
        transientUnfilteredError !== null &&
        !options?.force
      ) {
        const errorSnapshot = transientUnfilteredError;
        const sub: SlotSubscriber = {
          onResult: (result) => {
            if (sub.holdsTransientSsrError && result.data === null) {
              return;
            }
            if (slot.inflightLoadMore) {
              onUpdate({ ...result, isLoading: true });
            } else {
              onUpdate(result);
            }
          },
          pageOneFetcher: fetcher,
          pageOneOptions: options,
          retainsInflight: false,
          holdsTransientSsrError: true,
        };
        slot.subscribers.add(sub);
        onUpdate({ data: errorSnapshot, isLoading: false, error: null });
        return () => {
          detachSubscriber(queryKey, slot, sub);
        };
      }

      hasClientActivity = true;
      clearTransientUnfilteredError();

      const sub: SlotSubscriber = {
        onResult: (result) => {
          if (slot.inflightLoadMore) {
            onUpdate({ ...result, isLoading: true });
          } else {
            onUpdate(result);
          }
        },
        pageOneFetcher: fetcher,
        pageOneOptions: options,
        retainsInflight: true,
      };
      slot.subscribers.add(sub);

      if (isSlotFresh(slot) && !options?.force) {
        onUpdate({
          data: slot.cachedState!,
          isLoading: Boolean(slot.inflightLoadMore),
          error: null,
        });
      } else {
        const effectiveData =
          slot.cachedState ??
          (options?.initialData !== undefined ? options.initialData : null);
        const shouldShowLoading =
          (slot.cachedState === undefined &&
            options?.initialData === undefined) ||
          Boolean(options?.force);

        onUpdate({
          data: effectiveData,
          isLoading: shouldShowLoading || Boolean(slot.inflightLoadMore),
          error: null,
        });

        void launchPageOne(queryKey, slot, fetcher, options);
      }

      return () => {
        detachSubscriber(queryKey, slot, sub);
      };
    },

    subscribeSnapshot(query, onStoreChange, options) {
      const normalizedQuery = normalizeMentorPoolQuery(query);
      const queryKey = serializeMentorPoolQuery(normalizedQuery);

      if (options?.ssrSeed) {
        primeUnfilteredFromSSR(options.ssrSeed);
      }

      const slot = getOrCreateSlot(queryKey);

      const limit = options?.limit ?? defaultLimit;
      const pageOneFetcher: SlotPageOneFetcher = (signal) =>
        fetchMentorPoolPageOne(
          normalizedQuery,
          transport.fetchMentors,
          signal,
          limit
        );

      if (options?.force) {
        hasClientActivity = true;
        if (queryKey === UNFILTERED_QUERY_KEY) {
          clearTransientUnfilteredError();
        }
        cancelInflightLoadMore(slot);
      }

      if (
        queryKey === UNFILTERED_QUERY_KEY &&
        transientUnfilteredError !== null &&
        !options?.force
      ) {
        const sub: SlotSubscriber = {
          onStoreChange,
          onPageOneError: options?.onError,
          pageOneFetcher,
          retainsInflight: false,
          holdsTransientSsrError: true,
        };
        slot.subscribers.add(sub);
        syncSlotSnapshot(queryKey, slot);
        return () => {
          detachSubscriber(queryKey, slot, sub);
        };
      }

      hasClientActivity = true;
      clearTransientUnfilteredError();

      const sub: SlotSubscriber = {
        onStoreChange,
        onPageOneError: options?.onError,
        pageOneFetcher,
        retainsInflight: true,
      };
      slot.subscribers.add(sub);

      if (!isSlotFresh(slot) || options?.force) {
        void launchPageOne(queryKey, slot, pageOneFetcher, {
          force: options?.force,
        });
      } else {
        syncSlotSnapshot(queryKey, slot);
      }

      return () => {
        detachSubscriber(queryKey, slot, sub);
      };
    },

    getSnapshot(query, ssrSeed) {
      const normalizedQuery = normalizeMentorPoolQuery(query);
      const queryKey = serializeMentorPoolQuery(normalizedQuery);
      const slot = slots.get(queryKey);

      if (
        slot &&
        (slot.cachedState !== undefined ||
          slot.inflightPageOne !== undefined ||
          slot.inflightLoadMore !== undefined ||
          slot.ephemeralErrorState !== undefined)
      ) {
        return slot.snapshot;
      }

      if (
        queryKey === UNFILTERED_QUERY_KEY &&
        transientUnfilteredSnapshot !== null &&
        (!ssrSeed || Boolean(ssrSeed.initialError))
      ) {
        return transientUnfilteredSnapshot;
      }

      return resolveMemoizedSSRSnapshot(normalizedQuery, ssrSeed);
    },

    getServerSnapshot(query, ssrSeed) {
      const normalizedQuery = normalizeMentorPoolQuery(query);
      return resolveMemoizedSSRSnapshot(normalizedQuery, ssrSeed);
    },

    retry(query, options) {
      const normalizedQuery = normalizeMentorPoolQuery(query);
      const queryKey = serializeMentorPoolQuery(normalizedQuery);
      hasClientActivity = true;
      if (queryKey === UNFILTERED_QUERY_KEY) {
        clearTransientUnfilteredError();
      }

      const slot = getOrCreateSlot(queryKey);
      promoteTransientSsrSubscribers(slot);

      const limit = options?.limit ?? defaultLimit;
      return launchPageOne(
        queryKey,
        slot,
        (signal) =>
          fetchMentorPoolPageOne(
            normalizedQuery,
            transport.fetchMentors,
            signal,
            limit
          ),
        { force: true, imperative: true }
      );
    },

    loadMore(
      query: MentorPoolQuery,
      fetchPageOrOptions?: MentorPageFetcher | LoadMoreMentorPoolOptions,
      maybeOptions?: LoadMoreMentorPoolOptions
    ) {
      if (typeof fetchPageOrOptions === 'function') {
        return executeLoadMore(query, fetchPageOrOptions, maybeOptions);
      }
      return executeLoadMore(query, transport.fetchMentors, fetchPageOrOptions);
    },

    buildInitialUnfilteredState: buildUnfilteredState,

    clear() {
      transientUnfilteredError = null;
      transientUnfilteredSnapshot = null;
      hasClientActivity = false;

      const activeEntries: Array<[string, QuerySlot]> = [];
      Array.from(slots.entries()).forEach(([queryKey, slot]) => {
        cancelInflightPageOne(slot);
        cancelInflightLoadMore(slot);
        slot.cachedState = undefined;
        slot.isSeededFromSSR = undefined;
        slot.expiresAt = undefined;
        slot.ephemeralErrorState = undefined;

        if (slot.subscribers.size === 0) {
          slots.delete(queryKey);
        } else {
          promoteTransientSsrSubscribers(slot);
          activeEntries.push([queryKey, slot]);
        }
      });

      if (isClearing || activeEntries.length === 0) {
        if (isClearing) {
          activeEntries.forEach(([queryKey, slot]) => {
            if (syncSlotSnapshot(queryKey, slot)) {
              notifyStoreSubscribers(slot);
            }
          });
        }
        return;
      }

      isClearing = true;
      try {
        activeEntries.forEach(([queryKey, slot]) => {
          if (slots.get(queryKey) !== slot || slot.subscribers.size === 0) {
            return;
          }
          const fetcherSub = Array.from(slot.subscribers).find(
            (sub) => sub.retainsInflight && sub.pageOneFetcher !== undefined
          );
          if (fetcherSub?.pageOneFetcher) {
            hasClientActivity = true;
            notifyResultSubscribers(slot, {
              data: null,
              isLoading: true,
              error: null,
            });
            const relaunchOptions = fetcherSub.pageOneOptions
              ? {
                  ...fetcherSub.pageOneOptions,
                  initialData: undefined,
                  force: true,
                }
              : { force: true };
            void launchPageOne(
              queryKey,
              slot,
              fetcherSub.pageOneFetcher,
              relaunchOptions
            );
          } else if (syncSlotSnapshot(queryKey, slot)) {
            notifyStoreSubscribers(slot);
          }
        });
      } finally {
        isClearing = false;
      }
    },
  };
}

export const mentorPoolReadModel: MentorPoolReadModel =
  createMentorPoolReadModel();
