import { singleFlight } from './singleFlight';

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
    options?: {
      ttlMs?: number;
      shouldCache?: (value: V) => boolean;
      force?: boolean;
    }
  ): Promise<V>;

  // Read-only query for inflight promise (useful for testing or checking status)
  getInflight(key: K): Promise<V> | undefined;
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

  function getValidEntry(key: K): CacheEntry<V> | undefined {
    const entry = dataCache.get(key);
    if (!entry) return undefined;
    if (isExpired(entry)) {
      dataCache.delete(key);
      return undefined;
    }
    return entry;
  }

  function get(key: K): V | undefined {
    const entry = getValidEntry(key);
    return entry?.value;
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
    // Correctness fix: Manual sets should immediately invalidate and remove
    // any active in-flight promises to prevent older unresolved fetches from
    // overwriting the newer/freshly-set cache value later.
    inflightCache.delete(key);
  }

  function has(key: K): boolean {
    const entry = getValidEntry(key);
    return entry !== undefined;
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
    // Since set() already invalidates inflightCache, calling it here
    // automatically clears any in-flight promises cleanly.
    set(key, value, options?.ttlMs);
  }

  function getInflight(key: K): Promise<V> | undefined {
    return inflightCache.get(key);
  }

  function fetch(
    key: K,
    fetcher: () => Promise<V>,
    options?: {
      ttlMs?: number;
      shouldCache?: (value: V) => boolean;
      force?: boolean;
    }
  ): Promise<V> {
    if (!options?.force) {
      const entry = dataCache.get(key);
      if (entry && !isExpired(entry)) {
        return Promise.resolve(entry.value);
      }
    }

    // eslint-disable-next-line prefer-const
    let innerPromise: Promise<V>;
    const finalPromise = singleFlight(inflightCache, key, () => {
      innerPromise = fetcher().then((value) => {
        const currentInflight = getInflight(key);
        if (
          currentInflight &&
          (currentInflight === finalPromise || currentInflight === innerPromise)
        ) {
          if (!options?.shouldCache || options.shouldCache(value)) {
            set(key, value, options?.ttlMs);
          }
        }
        return value;
      });
      return innerPromise;
    });

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
  };
}
