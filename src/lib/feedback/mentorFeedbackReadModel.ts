import {
  type AsyncCacheSnapshot,
  type AsyncPrimeOptions,
  AsyncReadManager,
  type AsyncReadOptions,
  type AsyncReadResult,
  type AsyncReadSource,
} from '@/lib/asyncReadManager';
import { toFeedbackTimestampMs } from '@/lib/mentor/mentorStats';
import {
  DEFAULT_FEEDBACK_PAGE_SIZE,
  type MentorFeedbackItem,
  type MentorFeedbackPage,
} from '@/types/feedback';

export const MENTOR_FEEDBACK_CACHE_TTL_MS = 60_000;

export interface MentorFeedbackReadKey {
  mentorId: number;
  page?: number;
  pageSize?: number;
}

export interface NormalizedMentorFeedbackKey {
  mentorId: number;
  page: number;
  pageSize: number;
}

export type MentorFeedbackPageFetcher = (
  signal: AbortSignal,
  context?: { force?: boolean }
) => Promise<MentorFeedbackPage>;

export interface MentorFeedbackReadModelOptions {
  ttlMs?: number;
}

export interface MentorFeedbackReadModel extends AsyncReadSource<
  MentorFeedbackReadKey,
  MentorFeedbackPage
> {
  peek(key: MentorFeedbackReadKey): MentorFeedbackPage | undefined;
  getSnapshot(
    key: MentorFeedbackReadKey
  ): AsyncCacheSnapshot<MentorFeedbackPage> | undefined;
  prime(
    key: MentorFeedbackReadKey,
    value: MentorFeedbackPage,
    options?: AsyncPrimeOptions
  ): void;
  refresh(
    key: MentorFeedbackReadKey,
    fetcher: MentorFeedbackPageFetcher,
    options?: Omit<
      AsyncReadOptions<MentorFeedbackPage>,
      'force' | 'initialData'
    >
  ): Promise<AsyncReadResult<MentorFeedbackPage> | null>;
  invalidate(key: MentorFeedbackReadKey): void;
  /**
   * Invalidates cached mentor feedback pages.
   * - When `mentorId` is a positive finite number, refreshes actively
   *   subscribed page slices for that mentor in place and drops unsubscribed
   *   cached slices (while cancelling any unsubscribed in-flight requests),
   *   leaving all other mentors untouched.
   * - When `mentorId` is `undefined`, applies the same invalidation/refresh
   *   across every mentor currently tracked in the read model.
   */
  invalidateMentor(mentorId?: number): void;
  hasSubscribers(key: MentorFeedbackReadKey): boolean;
  clear(): void;
}

export function normalizeMentorFeedbackKey(
  key: MentorFeedbackReadKey
): NormalizedMentorFeedbackKey {
  const safeMentorId =
    typeof key.mentorId === 'number' && Number.isFinite(key.mentorId)
      ? Math.max(0, Math.floor(key.mentorId))
      : 0;
  const safePage =
    typeof key.page === 'number' && Number.isFinite(key.page)
      ? Math.max(1, Math.floor(key.page))
      : 1;
  const safePageSize =
    typeof key.pageSize === 'number' && Number.isFinite(key.pageSize)
      ? Math.max(1, Math.floor(key.pageSize))
      : DEFAULT_FEEDBACK_PAGE_SIZE;

  return {
    mentorId: safeMentorId,
    page: safePage,
    pageSize: safePageSize,
  };
}

export function toMentorFeedbackCacheKey(key: MentorFeedbackReadKey): string {
  const normalized = normalizeMentorFeedbackKey(key);
  return `${normalized.mentorId}:${normalized.page}:${normalized.pageSize}`;
}

/**
 * Sorts mentor feedback items newest-first by `createdAt` using a single-pass
 * timestamp extraction. When every item has a valid timestamp and is already in
 * descending order (or any item lacks a parseable date), avoids running
 * `Array.prototype.sort`.
 */
export function sortFeedbackItems(
  items: ReadonlyArray<MentorFeedbackItem>
): MentorFeedbackItem[] {
  const length = items.length;
  if (length <= 1) {
    return [...items];
  }

  const timestamps = new Array<number>(length);
  let allValidDates = true;
  let alreadyDescending = true;

  for (let i = 0; i < length; i += 1) {
    const ts = toFeedbackTimestampMs(items[i].createdAt);
    timestamps[i] = ts;
    if (ts <= 0) {
      allValidDates = false;
      break;
    }
    if (i > 0 && timestamps[i - 1] < ts) {
      alreadyDescending = false;
    }
  }

  if (!allValidDates || alreadyDescending) {
    return [...items];
  }

  const indices = Array.from({ length }, (_, idx) => idx);
  indices.sort((a, b) => timestamps[b] - timestamps[a] || a - b);
  return indices.map((idx) => items[idx]);
}

export function normalizeMentorFeedbackPage(
  page: MentorFeedbackPage
): MentorFeedbackPage {
  return {
    ...page,
    items: sortFeedbackItems(page.items),
  };
}

export function createMentorFeedbackReadModel(
  options?: MentorFeedbackReadModelOptions
): MentorFeedbackReadModel {
  const manager = new AsyncReadManager<string, MentorFeedbackPage>({
    ttlMs: options?.ttlMs ?? MENTOR_FEEDBACK_CACHE_TTL_MS,
  });

  const knownKeys = new Map<string, NormalizedMentorFeedbackKey>();
  const activeFetchers = new Map<string, Set<MentorFeedbackPageFetcher>>();

  const trackKey = (key: MentorFeedbackReadKey): string => {
    const normalized = normalizeMentorFeedbackKey(key);
    const cacheKey = `${normalized.mentorId}:${normalized.page}:${normalized.pageSize}`;
    knownKeys.set(cacheKey, normalized);
    return cacheKey;
  };

  const getLatestActiveFetcher = (
    cacheKey: string
  ): MentorFeedbackPageFetcher | undefined => {
    const fetcherSet = activeFetchers.get(cacheKey);
    if (!fetcherSet || fetcherSet.size === 0) {
      return undefined;
    }
    let latest: MentorFeedbackPageFetcher | undefined;
    fetcherSet.forEach((fn) => {
      latest = fn;
    });
    return latest;
  };

  const invalidateOrRefreshCacheKey = (cacheKey: string): void => {
    const listenerCount = manager.getListenerCount(cacheKey);
    const activeFetcher =
      listenerCount > 0 ? getLatestActiveFetcher(cacheKey) : undefined;

    if (activeFetcher) {
      void manager.refresh(cacheKey, activeFetcher);
      return;
    }

    manager.invalidate(cacheKey);
    if (listenerCount === 0) {
      activeFetchers.delete(cacheKey);
      knownKeys.delete(cacheKey);
    }
  };

  return {
    get(key) {
      return manager.get(toMentorFeedbackCacheKey(key));
    },

    peek(key) {
      return manager.peek(toMentorFeedbackCacheKey(key));
    },

    getSnapshot(key) {
      return manager.getSnapshot(toMentorFeedbackCacheKey(key));
    },

    set(key, value, ttlMs) {
      const cacheKey = trackKey(key);
      manager.set(cacheKey, normalizeMentorFeedbackPage(value), ttlMs);
    },

    prime(key, value, primeOptions) {
      const cacheKey = trackKey(key);
      if (primeOptions?.ifEmpty && manager.has(cacheKey)) {
        return;
      }
      manager.prime(cacheKey, normalizeMentorFeedbackPage(value), primeOptions);
    },

    refresh(key, fetcher, refreshOptions) {
      const cacheKey = trackKey(key);
      const wrappedFetcher: MentorFeedbackPageFetcher = async (
        signal,
        context
      ) => normalizeMentorFeedbackPage(await fetcher(signal, context));
      return manager.refresh(cacheKey, wrappedFetcher, refreshOptions);
    },

    subscribe(key, fetcher, onUpdate, readOptions) {
      const cacheKey = trackKey(key);
      const wrappedFetcher: MentorFeedbackPageFetcher = async (
        signal,
        context
      ) => normalizeMentorFeedbackPage(await fetcher(signal, context));

      let fetcherSet = activeFetchers.get(cacheKey);
      if (!fetcherSet) {
        fetcherSet = new Set<MentorFeedbackPageFetcher>();
        activeFetchers.set(cacheKey, fetcherSet);
      }
      fetcherSet.add(wrappedFetcher);

      const normalizedOptions:
        AsyncReadOptions<MentorFeedbackPage> | undefined =
        readOptions?.initialData !== undefined
          ? {
              ...readOptions,
              initialData: normalizeMentorFeedbackPage(readOptions.initialData),
            }
          : readOptions;

      const unsubscribe = manager.subscribe(
        cacheKey,
        wrappedFetcher,
        onUpdate,
        normalizedOptions
      );

      return () => {
        const currentSet = activeFetchers.get(cacheKey);
        if (currentSet) {
          currentSet.delete(wrappedFetcher);
          if (currentSet.size === 0) {
            activeFetchers.delete(cacheKey);
          }
        }
        unsubscribe();
      };
    },

    invalidate(key) {
      const cacheKey = toMentorFeedbackCacheKey(key);
      manager.invalidate(cacheKey);
      if (manager.getListenerCount(cacheKey) === 0) {
        activeFetchers.delete(cacheKey);
        knownKeys.delete(cacheKey);
      }
    },

    invalidateMentor(mentorId) {
      if (mentorId !== undefined) {
        if (
          typeof mentorId !== 'number' ||
          !Number.isFinite(mentorId) ||
          mentorId <= 0
        ) {
          return;
        }
        const targetMentorId = Math.floor(mentorId);
        for (const [cacheKey, parsed] of Array.from(knownKeys.entries())) {
          if (parsed.mentorId === targetMentorId) {
            invalidateOrRefreshCacheKey(cacheKey);
          }
        }
        return;
      }

      for (const cacheKey of Array.from(knownKeys.keys())) {
        invalidateOrRefreshCacheKey(cacheKey);
      }
    },

    hasSubscribers(key) {
      return manager.getListenerCount(toMentorFeedbackCacheKey(key)) > 0;
    },

    clear() {
      knownKeys.clear();
      activeFetchers.clear();
      manager.clear();
    },
  };
}

export const mentorFeedbackReadModel: MentorFeedbackReadModel =
  createMentorFeedbackReadModel();
