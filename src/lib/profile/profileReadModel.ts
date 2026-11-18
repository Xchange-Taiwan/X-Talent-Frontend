import {
  type AsyncCacheSnapshot,
  type AsyncPrimeOptions,
  AsyncReadManager,
  type AsyncReadOptions,
  type AsyncReadResult,
  type AsyncReadSource,
} from '@/lib/asyncReadManager';
import {
  optimisticIdentityFromDto,
  type OptimisticIdentityProjection,
} from '@/lib/identity/identityProjection';
import { hasProfileDtoConverged } from '@/lib/profile/convergence';
import { normalizePositiveUserId } from '@/lib/profile/userId';
import type { MentorProfileVO } from '@/types/user';

export { hasProfileDtoConverged };
export const hasDtoConverged = hasProfileDtoConverged;

export const PROFILE_READ_MODEL_TTL_MS = 60_000;
export const USER_PROFILE_DTO_CACHE_TTL_MS = PROFILE_READ_MODEL_TTL_MS;
export const OPTIMISTIC_TRANSITION_WINDOW_MS = 10_000;

export interface ProfileReadKey {
  userId: number | string;
  language: string;
}

export type ProfileFetcher = (
  signal: AbortSignal,
  context?: { force?: boolean }
) => Promise<MentorProfileVO | null>;

export interface CreateProfileReadModelOptions {
  ttlMs?: number;
  transitionWindowMs?: number;
  now?: () => number;
}

export interface ProfileReadModel extends AsyncReadSource<
  ProfileReadKey,
  MentorProfileVO | null
> {
  get(key: ProfileReadKey): MentorProfileVO | null | undefined;
  peek(key: ProfileReadKey): MentorProfileVO | null | undefined;
  getSnapshot(
    key: ProfileReadKey
  ): AsyncCacheSnapshot<MentorProfileVO | null> | undefined;
  set(key: ProfileReadKey, value: MentorProfileVO | null, ttlMs?: number): void;
  prime(
    key: ProfileReadKey,
    value: MentorProfileVO | null,
    options?: AsyncPrimeOptions
  ): void;
  subscribe(
    key: ProfileReadKey,
    fetcher: ProfileFetcher,
    onUpdate: (result: AsyncReadResult<MentorProfileVO | null>) => void,
    options?: AsyncReadOptions<MentorProfileVO | null>
  ): () => void;
  observe(key: ProfileReadKey, listener: () => void): () => void;
  prefetch(
    key: ProfileReadKey,
    fetcher: ProfileFetcher,
    options?: Omit<
      AsyncReadOptions<MentorProfileVO | null>,
      'force' | 'initialData'
    >
  ): Promise<AsyncReadResult<MentorProfileVO | null> | null>;
  refresh(
    key: ProfileReadKey,
    fetcher: ProfileFetcher,
    options?: Omit<
      AsyncReadOptions<MentorProfileVO | null>,
      'force' | 'initialData'
    >
  ): Promise<AsyncReadResult<MentorProfileVO | null> | null>;
  evict(key: ProfileReadKey): void;
  invalidate(key: ProfileReadKey): void;
  invalidateUser(userId: number | string): void;
  clear(): void;
  resolveInitialData(
    key: ProfileReadKey | null | undefined,
    initialData?: MentorProfileVO | null
  ): MentorProfileVO | null | undefined;
  shouldCache(
    key: ProfileReadKey | null | undefined,
    value: MentorProfileVO | null
  ): boolean;
  resolveFetch(
    key: ProfileReadKey | null | undefined,
    fetcher: (signal: AbortSignal) => Promise<MentorProfileVO | null>,
    signal: AbortSignal,
    context?: { force?: boolean }
  ): Promise<MentorProfileVO | null>;
  getLastPrimedTime(): number;
  isOptimisticTransitionActive(): boolean;
  subscribeTransition(listener: () => void): () => void;
  observeOptimisticIdentity(
    userId: number | string,
    listener: () => void
  ): () => void;
  getOptimisticIdentity(
    userId: number | string,
    language?: string
  ): OptimisticIdentityProjection | undefined;
}

export function toProfileCacheKey(key: ProfileReadKey): string {
  const canonicalId = normalizePositiveUserId(key.userId) ?? String(key.userId);
  return `${canonicalId}-${key.language}`;
}

export function parseProfileCacheKey(
  rawKey: string | null | undefined
): ProfileReadKey | null {
  if (!rawKey) return null;
  const dashIndex = rawKey.indexOf('-');
  if (dashIndex <= 0) return null;
  const rawId = normalizePositiveUserId(rawKey.slice(0, dashIndex));
  const language = rawKey.slice(dashIndex + 1);
  if (!rawId || !language) {
    return null;
  }
  const asNum = Number(rawId);
  return {
    userId: Number.isSafeInteger(asNum) ? asNum : rawId,
    language,
  };
}

export function createProfileReadModel(
  options?: CreateProfileReadModelOptions
): ProfileReadModel {
  const ttlMs = options?.ttlMs ?? PROFILE_READ_MODEL_TTL_MS;
  const transitionWindowMs =
    options?.transitionWindowMs ?? OPTIMISTIC_TRANSITION_WINDOW_MS;
  const readNow = options?.now ?? (() => Date.now());

  const manager = new AsyncReadManager<string, MentorProfileVO | null>({
    ttlMs,
  });

  const trackedKeysByUser = new Map<string, Set<string>>();
  const lastPrimedKeyByUser = new Map<string, string>();
  const transitionListeners = new Set<() => void>();
  const identityObservers = new Map<string, Set<() => void>>();
  let projectionMemo = new WeakMap<
    MentorProfileVO,
    OptimisticIdentityProjection
  >();

  let lastPrimedTime = 0;
  let lastPrimedUserId: string | null = null;
  let transitionTimer: ReturnType<typeof setTimeout> | null = null;

  const toCanonicalUserKey = (userId: number | string): string | null =>
    normalizePositiveUserId(userId);

  const trackKey = (key: ProfileReadKey): string => {
    const cacheKey = toProfileCacheKey(key);
    const userKey = toCanonicalUserKey(key.userId);
    if (userKey) {
      let userSet = trackedKeysByUser.get(userKey);
      if (!userSet) {
        userSet = new Set<string>();
        trackedKeysByUser.set(userKey, userSet);
      }
      userSet.add(cacheKey);
    }
    return cacheKey;
  };

  const notifyTransitionListeners = (): void => {
    Array.from(transitionListeners).forEach((listener) => {
      if (!transitionListeners.has(listener)) return;
      try {
        listener();
      } catch (e) {
        console.error('Error in transition listener:', e);
      }
    });
  };

  const notifyIdentityObservers = (userId?: number | string): void => {
    if (userId !== undefined) {
      const userKey = toCanonicalUserKey(userId);
      if (!userKey) return;
      const observers = identityObservers.get(userKey);
      if (!observers) return;
      Array.from(observers).forEach((listener) => {
        if (!observers.has(listener)) return;
        try {
          listener();
        } catch (e) {
          console.error('Error notifying identity observer:', e);
        }
      });
      return;
    }

    Array.from(identityObservers.values()).forEach((observers) => {
      Array.from(observers).forEach((listener) => {
        if (!observers.has(listener)) return;
        try {
          listener();
        } catch (e) {
          console.error('Error notifying identity observer:', e);
        }
      });
    });
  };

  const resetTransition = (shouldNotify: boolean): void => {
    lastPrimedTime = 0;
    lastPrimedUserId = null;
    if (transitionTimer) {
      clearTimeout(transitionTimer);
      transitionTimer = null;
    }
    if (shouldNotify) {
      notifyTransitionListeners();
    }
  };

  const isOptimisticTransitionActive = (): boolean =>
    lastPrimedTime > 0 && readNow() - lastPrimedTime < transitionWindowMs;

  const resolveInitialData = (
    key: ProfileReadKey | null | undefined,
    initialData?: MentorProfileVO | null
  ): MentorProfileVO | null | undefined => {
    if (!key) return initialData;
    const hasCache = manager.getSnapshot(toProfileCacheKey(key)) !== undefined;
    return hasCache ? undefined : initialData;
  };

  const shouldCache = (
    key: ProfileReadKey | null | undefined,
    value: MentorProfileVO | null
  ): boolean => {
    if (value === null) return false;
    if (!key) return true;
    return value !== manager.get(toProfileCacheKey(key));
  };

  const resolveFetch = async (
    key: ProfileReadKey | null | undefined,
    fetcher: (signal: AbortSignal) => Promise<MentorProfileVO | null>,
    signal: AbortSignal,
    context?: { force?: boolean }
  ): Promise<MentorProfileVO | null> => {
    const isManualRefetch = !!context?.force;
    const cacheKey = key ? toProfileCacheKey(key) : null;

    try {
      const res = await fetcher(signal);

      if (res === null && cacheKey) {
        if (isManualRefetch) {
          manager.evict(cacheKey);
          return null;
        }
        const existing = manager.peek(cacheKey);
        if (existing) {
          return existing;
        }
        return null;
      }

      if (
        res !== null &&
        cacheKey &&
        !isManualRefetch &&
        isOptimisticTransitionActive()
      ) {
        const existing = manager.peek(cacheKey);
        if (existing && !hasProfileDtoConverged(existing, res)) {
          return existing;
        }
      }

      return res;
    } catch (err) {
      if (isManualRefetch && cacheKey) {
        manager.evict(cacheKey);
      }
      throw err;
    }
  };

  return {
    get(key) {
      return manager.get(toProfileCacheKey(key));
    },

    peek(key) {
      return manager.peek(toProfileCacheKey(key));
    },

    getSnapshot(key) {
      return manager.getSnapshot(toProfileCacheKey(key));
    },

    set(key, value, customTtlMs) {
      const cacheKey = trackKey(key);
      manager.set(cacheKey, value, customTtlMs);
      notifyIdentityObservers(key.userId);
    },

    prime(key, value, primeOptions) {
      if (value === null) {
        return;
      }
      const cacheKey = trackKey(key);
      if (primeOptions?.ifEmpty) {
        manager.prime(cacheKey, value, primeOptions);
        return;
      }

      manager.prime(cacheKey, value, primeOptions);
      const userKey = toCanonicalUserKey(key.userId);
      lastPrimedTime = readNow();
      lastPrimedUserId = userKey;
      if (userKey) {
        lastPrimedKeyByUser.set(userKey, cacheKey);
      }

      if (transitionTimer) {
        clearTimeout(transitionTimer);
      }
      transitionTimer = setTimeout(() => {
        transitionTimer = null;
        notifyTransitionListeners();
        notifyIdentityObservers(key.userId);
      }, transitionWindowMs);

      notifyTransitionListeners();
      notifyIdentityObservers(key.userId);
    },

    subscribe(key, fetcher, onUpdate, readOptions) {
      const cacheKey = trackKey(key);
      const hasCache = manager.getSnapshot(cacheKey) !== undefined;
      const effectiveInitialData = hasCache
        ? undefined
        : readOptions?.initialData;

      if (!hasCache && !readOptions?.force && effectiveInitialData === null) {
        onUpdate({ data: null, isLoading: false, error: null });
        return manager.observe(cacheKey, () => {
          const latest = manager.peek(cacheKey);
          if (latest !== undefined) {
            onUpdate({ data: latest, isLoading: false, error: null });
          }
        });
      }

      const wrappedFetcher: ProfileFetcher = (signal, context) =>
        resolveFetch(key, (s) => fetcher(s, context), signal, context);

      const normalizedOptions: AsyncReadOptions<MentorProfileVO | null> = {
        ...readOptions,
        initialData: effectiveInitialData,
        shouldCache: (value) =>
          shouldCache(key, value) &&
          (!readOptions?.shouldCache || readOptions.shouldCache(value)),
      };

      return manager.subscribe(
        cacheKey,
        wrappedFetcher,
        (result) => {
          if (!result.isLoading) {
            notifyIdentityObservers(key.userId);
          }
          onUpdate(result);
        },
        normalizedOptions
      );
    },

    observe(key, listener) {
      const cacheKey = trackKey(key);
      return manager.observe(cacheKey, listener);
    },

    prefetch(key, fetcher, prefetchOptions) {
      const cacheKey = trackKey(key);
      const wrappedFetcher: ProfileFetcher = (signal, context) =>
        resolveFetch(key, (s) => fetcher(s, context), signal, context);
      return manager
        .prefetch(cacheKey, wrappedFetcher, {
          ...prefetchOptions,
          shouldCache: (value) =>
            shouldCache(key, value) &&
            (!prefetchOptions?.shouldCache ||
              prefetchOptions.shouldCache(value)),
        })
        .then((res) => {
          notifyIdentityObservers(key.userId);
          return res;
        });
    },

    refresh(key, fetcher, refreshOptions) {
      const cacheKey = trackKey(key);
      const wrappedFetcher: ProfileFetcher = (signal, context) =>
        resolveFetch(key, (s) => fetcher(s, context), signal, context);
      return manager
        .refresh(cacheKey, wrappedFetcher, {
          ...refreshOptions,
          shouldCache: (value) =>
            shouldCache(key, value) &&
            (!refreshOptions?.shouldCache || refreshOptions.shouldCache(value)),
        })
        .then((res) => {
          notifyIdentityObservers(key.userId);
          return res;
        });
    },

    evict(key) {
      manager.evict(toProfileCacheKey(key));
      notifyIdentityObservers(key.userId);
    },

    invalidate(key) {
      const cacheKey = toProfileCacheKey(key);
      const userKey = toCanonicalUserKey(key.userId);
      manager.invalidate(cacheKey);
      if (userKey && manager.getListenerCount(cacheKey) === 0) {
        const userSet = trackedKeysByUser.get(userKey);
        if (userSet) {
          userSet.delete(cacheKey);
          if (userSet.size === 0) {
            trackedKeysByUser.delete(userKey);
          }
        }
      }
      if (userKey && lastPrimedKeyByUser.get(userKey) === cacheKey) {
        lastPrimedKeyByUser.delete(userKey);
      }
      if (lastPrimedUserId === null || lastPrimedUserId === userKey) {
        resetTransition(true);
      }
      notifyIdentityObservers(key.userId);
    },

    invalidateUser(userId) {
      const userKey = toCanonicalUserKey(userId);
      if (!userKey) return;
      const userSet = trackedKeysByUser.get(userKey);
      if (userSet) {
        for (const cacheKey of Array.from(userSet)) {
          manager.invalidate(cacheKey);
          if (manager.getListenerCount(cacheKey) === 0) {
            userSet.delete(cacheKey);
          }
        }
        if (userSet.size === 0) {
          trackedKeysByUser.delete(userKey);
        }
      }
      lastPrimedKeyByUser.delete(userKey);
      if (lastPrimedUserId === null || lastPrimedUserId === userKey) {
        resetTransition(true);
      }
      notifyIdentityObservers(userId);
    },

    clear() {
      trackedKeysByUser.clear();
      lastPrimedKeyByUser.clear();
      projectionMemo = new WeakMap<
        MentorProfileVO,
        OptimisticIdentityProjection
      >();
      manager.clear();
      resetTransition(true);
      notifyIdentityObservers();
    },

    resolveInitialData,
    shouldCache,
    resolveFetch,

    getLastPrimedTime() {
      return lastPrimedTime;
    },

    isOptimisticTransitionActive,

    subscribeTransition(listener) {
      transitionListeners.add(listener);
      return () => {
        transitionListeners.delete(listener);
      };
    },

    observeOptimisticIdentity(userId, listener) {
      const userKey = toCanonicalUserKey(userId);
      if (!userKey) {
        return () => {};
      }
      let set = identityObservers.get(userKey);
      if (!set) {
        set = new Set<() => void>();
        identityObservers.set(userKey, set);
      }
      set.add(listener);

      return () => {
        const current = identityObservers.get(userKey);
        if (current) {
          current.delete(listener);
          if (current.size === 0) {
            identityObservers.delete(userKey);
          }
        }
      };
    },

    getOptimisticIdentity(userId, language) {
      const userKey = toCanonicalUserKey(userId);
      if (!userKey || !isOptimisticTransitionActive()) {
        return undefined;
      }

      let cachedDto: MentorProfileVO | null | undefined;
      if (language) {
        cachedDto = manager.peek(
          toProfileCacheKey({ userId: userKey, language })
        );
      } else {
        const primedCacheKey = lastPrimedKeyByUser.get(userKey);
        if (primedCacheKey) {
          cachedDto = manager.peek(primedCacheKey);
        }
        if (!cachedDto) {
          cachedDto = manager.peek(`${userKey}-zh_TW`);
        }
        if (!cachedDto) {
          const userSet = trackedKeysByUser.get(userKey);
          if (userSet) {
            for (const cacheKey of Array.from(userSet)) {
              const candidate = manager.peek(cacheKey);
              if (candidate) {
                cachedDto = candidate;
                break;
              }
            }
          }
        }
      }

      if (!cachedDto) {
        return undefined;
      }

      const memoized = projectionMemo.get(cachedDto);
      if (memoized) {
        return memoized;
      }

      const projected = optimisticIdentityFromDto(cachedDto);
      projectionMemo.set(cachedDto, projected);
      return projected;
    },
  };
}

export const profileReadModel: ProfileReadModel = createProfileReadModel();
