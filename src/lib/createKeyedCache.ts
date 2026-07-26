export interface KeyedCacheOptions {
  ttlMs?: number;
}

export interface PrimeOptions {
  ifEmpty?: boolean;
  ttlMs?: number;
}

export interface CacheEntryResult<V> {
  value: V;
  isStale: boolean;
}

export interface KeyedCache<K, V> {
  get(key: K): V | undefined;
  getWithStatus(key: K): CacheEntryResult<V> | undefined;
  set(key: K, value: V, ttlMs?: number): void;
  has(key: K): boolean;
  delete(key: K): void;
  clear(): void;
  prime(key: K, value: V, options?: PrimeOptions): void;
  fetch(
    key: K,
    fetcher: () => Promise<V>,
    options?: { ttlMs?: number; shouldCache?: (value: V) => boolean }
  ): Promise<V>;

  // Inflight management (useful for custom inflight tracking like in scheduleCache)
  getInflight(key: K): Promise<V> | undefined;
  setInflight(key: K, promise: Promise<V>): Promise<V>;
  deleteInflight(key: K): void;
}

interface CacheEntry<V> {
  value: V;
  expiresAt?: number;
}

/**
 * Factory function to create a keyed cache with support for:
 * - TTL (Time to Live)
 * - In-flight request de-duplication (single-flight)
 * - Priming/Seeding (forcing or conditional)
 * - Stale-While-Revalidate pattern (via getWithStatus)
 */
export function createKeyedCache<K, V>(
  globalOptions?: KeyedCacheOptions
): KeyedCache<K, V> {
  const dataCache = new Map<K, CacheEntry<V>>();
  const inflightCache = new Map<K, Promise<V>>();

  function isExpired(entry: CacheEntry<V>): boolean {
    if (entry.expiresAt === undefined) return false;
    return Date.now() >= entry.expiresAt;
  }

  function get(key: K): V | undefined {
    const entry = dataCache.get(key);
    if (!entry) return undefined;
    if (isExpired(entry)) {
      dataCache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function getWithStatus(key: K): CacheEntryResult<V> | undefined {
    const entry = dataCache.get(key);
    if (!entry) return undefined;
    return {
      value: entry.value,
      isStale: isExpired(entry),
    };
  }

  function set(key: K, value: V, ttlMs?: number): void {
    const resolvedTtl = ttlMs !== undefined ? ttlMs : globalOptions?.ttlMs;
    const expiresAt =
      resolvedTtl !== undefined ? Date.now() + resolvedTtl : undefined;
    dataCache.set(key, { value, expiresAt });
  }

  function has(key: K): boolean {
    const entry = dataCache.get(key);
    if (!entry) return false;
    if (isExpired(entry)) {
      dataCache.delete(key);
      return false;
    }
    return true;
  }

  function deleteKey(key: K): void {
    dataCache.delete(key);
    inflightCache.delete(key);
  }

  function clear(): void {
    dataCache.clear();
    inflightCache.clear();
  }

  function prime(key: K, value: V, options?: PrimeOptions): void {
    if (options?.ifEmpty) {
      const existing = dataCache.get(key);
      if (existing && !isExpired(existing)) {
        return;
      }
    }
    set(key, value, options?.ttlMs);
    // Drop any inflight promise so subsequent callers don't wait for old data.
    inflightCache.delete(key);
  }

  function getInflight(key: K): Promise<V> | undefined {
    return inflightCache.get(key);
  }

  function setInflight(key: K, promise: Promise<V>): Promise<V> {
    const finalPromise = promise.finally(() => {
      if (inflightCache.get(key) === finalPromise) {
        inflightCache.delete(key);
      }
    });
    inflightCache.set(key, finalPromise);
    return finalPromise;
  }

  function deleteInflight(key: K): void {
    inflightCache.delete(key);
  }

  function fetch(
    key: K,
    fetcher: () => Promise<V>,
    options?: { ttlMs?: number; shouldCache?: (value: V) => boolean }
  ): Promise<V> {
    // Correctness fix: Use dataCache directly rather than calling get(key),
    // to avoid deleting the expired cache prematurely and ruining SWR.
    const entry = dataCache.get(key);
    if (entry && !isExpired(entry)) {
      return Promise.resolve(entry.value);
    }

    const inflight = getInflight(key);
    if (inflight) {
      return inflight;
    }

    // eslint-disable-next-line prefer-const
    let finalPromise: Promise<V>;

    const promise = fetcher().then((value) => {
      // Race Condition fix: Only write to cache if this is still the current inflight promise
      if (getInflight(key) === finalPromise) {
        if (!options?.shouldCache || options.shouldCache(value)) {
          set(key, value, options?.ttlMs);
        }
      }
      return value;
    });

    finalPromise = setInflight(key, promise);
    return finalPromise;
  }

  return {
    get,
    getWithStatus,
    set,
    has,
    delete: deleteKey,
    clear,
    prime,
    fetch,
    getInflight,
    setInflight,
    deleteInflight,
  };
}
