export interface AsyncReadResult<V> {
  data: V | null;
  isLoading: boolean;
  error: string | null;
}

export interface AsyncReadManagerOptions {
  ttlMs?: number;
}

export interface AsyncPrimeOptions {
  ifEmpty?: boolean;
  ttlMs?: number;
}

export interface AsyncCacheSnapshot<V> {
  value: V;
  isStale: boolean;
}

export interface AsyncReadOptions<V> {
  ttlMs?: number;
  force?: boolean;
  initialData?: V;
  shouldCache?: (value: V) => boolean;
}

interface CacheEntry<V> {
  value: V;
  expiresAt?: number;
}

interface ListenerEntry<V> {
  onUpdate: (result: AsyncReadResult<V>) => void;
  retainsInflight: boolean;
}

interface InflightEntry<V> {
  promise: Promise<AsyncReadResult<V> | null>;
  controller: AbortController;
  imperativeCount: number;
}

/**
 * The subset of `AsyncReadManager`'s public surface that `useAsyncRead`
 * actually depends on. Consumers that want a domain-shaped key (e.g.
 * `ReservationReadModel`, keyed by `{ userId, state }` instead of a raw
 * string) can wrap a private `AsyncReadManager` instance and hand this
 * structural shape to `useAsyncRead` without exposing the manager itself.
 */
export interface AsyncReadSource<K, V> {
  get(key: K): V | undefined;
  peek?(key: K): V | undefined;
  getSnapshot?(key: K): AsyncCacheSnapshot<V> | undefined;
  set(key: K, value: V, ttlMs?: number): void;
  prime?(key: K, value: V, options?: AsyncPrimeOptions): void;
  subscribe(
    key: K,
    fetcher: (signal: AbortSignal, context?: { force?: boolean }) => Promise<V>,
    onUpdate: (result: AsyncReadResult<V>) => void,
    options?: AsyncReadOptions<V>
  ): () => void;
}

export class AsyncReadManager<K, V> implements AsyncReadSource<K, V> {
  private entries = new Map<K, CacheEntry<V>>();
  private listeners = new Map<K, Set<ListenerEntry<V>>>();
  private inflight = new Map<K, InflightEntry<V>>();
  private defaultTtlMs?: number;

  constructor(options?: AsyncReadManagerOptions) {
    this.defaultTtlMs = options?.ttlMs;
  }

  private isExpired(entry: CacheEntry<V>): boolean {
    if (entry.expiresAt === undefined) return false;
    return Date.now() >= entry.expiresAt;
  }

  private writeEntry(key: K, value: V, ttlMs?: number): void {
    const resolvedTtl = ttlMs !== undefined ? ttlMs : this.defaultTtlMs;
    const expiresAt =
      resolvedTtl !== undefined ? Date.now() + resolvedTtl : undefined;
    this.entries.set(key, { value, expiresAt });
  }

  private cancelInflight(key: K): void {
    const entry = this.inflight.get(key);
    if (entry) {
      this.inflight.delete(key);
      entry.controller.abort();
    }
  }

  private hasRetainingListener(key: K): boolean {
    const activeListeners = this.listeners.get(key);
    if (!activeListeners) return false;
    return Array.from(activeListeners).some(
      (listener) => listener.retainsInflight
    );
  }

  private notifyListeners(key: K, result: AsyncReadResult<V>): void {
    const activeListeners = this.listeners.get(key);
    if (!activeListeners) return;
    Array.from(activeListeners).forEach((listener) => {
      if (activeListeners.has(listener)) {
        listener.onUpdate(result);
      }
    });
  }

  private launchInflight(
    key: K,
    fetcher: (signal: AbortSignal, context?: { force?: boolean }) => Promise<V>,
    options?: AsyncReadOptions<V>,
    imperativeCount = 0
  ): InflightEntry<V> {
    const controller = new AbortController();
    const force = !!options?.force;

    let rawPromise: Promise<V>;
    try {
      rawPromise = Promise.resolve(fetcher(controller.signal, { force }));
    } catch (syncErr) {
      rawPromise = Promise.reject(syncErr);
    }

    // Never rejects: both branches settle to `AsyncReadResult<V> | null` after
    // notifying subscribers so imperative callers (`refresh`, `prefetch`) never
    // trigger unhandled promise rejections.
    const promise = rawPromise.then(
      (value): AsyncReadResult<V> | null => {
        if (this.inflight.get(key)?.controller === controller) {
          this.inflight.delete(key);
        }
        // Guards against a fetcher that ignores the AbortSignal and resolves
        // anyway: abort() flags the signal synchronously, and any write
        // (set/prime/update/invalidate) that superseded this fetch already ran
        // before this callback was queued.
        if (controller.signal.aborted) {
          return null;
        }
        if (!options?.shouldCache || options.shouldCache(value)) {
          this.writeEntry(key, value, options?.ttlMs);
        }
        const result: AsyncReadResult<V> = {
          data: value,
          isLoading: false,
          error: null,
        };
        this.notifyListeners(key, result);
        return result;
      },
      (err): AsyncReadResult<V> | null => {
        if (this.inflight.get(key)?.controller === controller) {
          this.inflight.delete(key);
        }
        // Only *our own* abort counts as routine cancellation. Do not also
        // match on `err.name === 'AbortError'`: a fetcher can reject with that
        // name for an unrelated internal timeout signal, and treating that as
        // routine would swallow a real failure.
        if (controller.signal.aborted) {
          return null;
        }
        const currentSnapshot = this.getSnapshot(key);
        const fallbackData =
          currentSnapshot !== undefined
            ? currentSnapshot.value
            : options?.initialData !== undefined
              ? options.initialData
              : null;

        const result: AsyncReadResult<V> = {
          data: fallbackData,
          isLoading: false,
          error: err instanceof Error ? err.message : String(err),
        };
        this.notifyListeners(key, result);
        return result;
      }
    );

    const entry: InflightEntry<V> = {
      promise,
      controller,
      imperativeCount,
    };
    if (!controller.signal.aborted) {
      this.inflight.set(key, entry);
    }
    return entry;
  }

  /**
   * Non-destructive SWR inspection: returns the stored value and whether its
   * TTL has elapsed without deleting expired entries.
   */
  public getSnapshot(key: K): AsyncCacheSnapshot<V> | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    return {
      value: entry.value,
      isStale: this.isExpired(entry),
    };
  }

  /**
   * Non-destructive value read: returns the stored value (fresh or stale)
   * without deleting expired entries, or `undefined` if absent.
   */
  public peek(key: K): V | undefined {
    return this.entries.get(key)?.value;
  }

  /**
   * Returns the fresh cached value for `key`, or `undefined` if absent or
   * expired. Never deletes expired entries so subsequent SWR subscribers can
   * still serve stale data while revalidating.
   */
  public get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry || this.isExpired(entry)) {
      return undefined;
    }
    return entry.value;
  }

  public has(key: K): boolean {
    const entry = this.entries.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  public set(key: K, value: V, ttlMs?: number): void {
    // A write always wins over whatever fetch is in flight for this key,
    // otherwise a late response can resolve after the write and clobber it.
    this.cancelInflight(key);
    this.writeEntry(key, value, ttlMs);
    this.notifyListeners(key, { data: value, isLoading: false, error: null });
  }

  /**
   * Seed the cache for `key`. When `options.ifEmpty` is true, preserves an
   * existing fresh entry without cancelling any in-flight read; otherwise
   * writes `value` and cancels any competing in-flight fetch.
   */
  public prime(key: K, value: V, options?: AsyncPrimeOptions): void {
    if (options?.ifEmpty && this.has(key)) {
      return;
    }
    this.set(key, value, options?.ttlMs);
  }

  /**
   * Update the value at `key` derived from its current cached value (fresh or
   * stale). Returning `undefined` from `updater` is a no-op (nothing to update
   * from), whereas returning a value writes it and refreshes its TTL.
   */
  public update(
    key: K,
    updater: (current: V | undefined) => V | undefined,
    ttlMs?: number
  ): void {
    const next = updater(this.peek(key));
    if (next === undefined) {
      return;
    }
    this.set(key, next, ttlMs);
  }

  /** Drop the cached value at `key` and cancel any fetch in flight for it. */
  public invalidate(key: K): void {
    this.cancelInflight(key);
    this.entries.delete(key);
    this.notifyListeners(key, { data: null, isLoading: false, error: null });
  }

  /**
   * Drop the cached value at `key` without touching any fetch in flight for
   * it. Use this from inside that very fetch's own fetcher (e.g. a manual
   * refetch that resolved to "not found" or failed, and wants to evict the
   * now-stale entry) without aborting its own `AbortSignal`.
   */
  public evict(key: K): void {
    this.entries.delete(key);
  }

  /**
   * Imperatively refetch `key` from the network even on a fresh cache hit,
   * publish the settled result to all live subscribers, and resolve once it
   * has landed (or resolve `null` if superseded mid-flight by a write/clear).
   */
  public refresh(
    key: K,
    fetcher: (signal: AbortSignal, context?: { force?: boolean }) => Promise<V>,
    options?: Omit<AsyncReadOptions<V>, 'force' | 'initialData'>
  ): Promise<AsyncReadResult<V> | null> {
    this.cancelInflight(key);
    const entry = this.launchInflight(
      key,
      fetcher,
      { ...options, force: true },
      1
    );
    return entry.promise.finally(() => {
      entry.imperativeCount = Math.max(0, entry.imperativeCount - 1);
    });
  }

  /**
   * Warm `key` in the background with no subscriber mounted. A fresh cache hit
   * is a no-op, an existing in-flight read for `key` is joined rather than
   * duplicated, and fetch errors are swallowed into the returned result rather
   * than rejected.
   */
  public prefetch(
    key: K,
    fetcher: (signal: AbortSignal, context?: { force?: boolean }) => Promise<V>,
    options?: Omit<AsyncReadOptions<V>, 'force' | 'initialData'>
  ): Promise<AsyncReadResult<V> | null> {
    if (this.has(key)) {
      return Promise.resolve({
        data: this.entries.get(key)!.value,
        isLoading: false,
        error: null,
      });
    }

    const existing = this.inflight.get(key);
    if (existing) {
      existing.imperativeCount += 1;
      return existing.promise.finally(() => {
        existing.imperativeCount = Math.max(0, existing.imperativeCount - 1);
      });
    }

    const entry = this.launchInflight(
      key,
      fetcher,
      { ...options, force: false },
      1
    );
    return entry.promise.finally(() => {
      entry.imperativeCount = Math.max(0, entry.imperativeCount - 1);
    });
  }

  /**
   * Passively observe cache mutations and settled reads for `key` (e.g. for
   * `useSyncExternalStore`) without starting or retaining in-flight fetches.
   */
  public observe(key: K, listener: () => void): () => void {
    const entry: ListenerEntry<V> = {
      onUpdate: () => {
        try {
          listener();
        } catch (e) {
          console.error('Error notifying cache observer:', e);
        }
      },
      retainsInflight: false,
    };
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set<ListenerEntry<V>>();
      this.listeners.set(key, set);
    }
    set.add(entry);

    return () => {
      const activeListeners = this.listeners.get(key);
      if (activeListeners) {
        activeListeners.delete(entry);
        if (activeListeners.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  public getInflightCount(): number {
    return this.inflight.size;
  }

  public getListenerCount(key: K): number {
    const activeListeners = this.listeners.get(key);
    if (!activeListeners) return 0;
    let count = 0;
    activeListeners.forEach((listener) => {
      if (listener.retainsInflight) {
        count += 1;
      }
    });
    return count;
  }

  public clear(): void {
    const activeInflight = Array.from(this.inflight.values());
    this.entries.clear();
    this.listeners.clear();
    this.inflight.clear();
    activeInflight.forEach((entry) => entry.controller.abort());
  }

  public subscribe(
    key: K,
    fetcher: (signal: AbortSignal, context?: { force?: boolean }) => Promise<V>,
    onUpdate: (result: AsyncReadResult<V>) => void,
    options?: AsyncReadOptions<V>
  ): () => void {
    const snapshot = this.getSnapshot(key);
    const hasCache = snapshot !== undefined;
    const isStale = snapshot?.isStale ?? false;

    const hasInitialData = options?.initialData !== undefined;
    const effectiveData = hasCache
      ? snapshot.value
      : hasInitialData
        ? options!.initialData!
        : null;

    const sub: ListenerEntry<V> = { onUpdate, retainsInflight: true };
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set<ListenerEntry<V>>();
      this.listeners.set(key, set);
    }
    set.add(sub);

    if (hasCache && !options?.force && !isStale) {
      onUpdate({ data: snapshot.value, isLoading: false, error: null });
    } else {
      const shouldShowLoading =
        (!hasCache && !hasInitialData) || !!options?.force;
      onUpdate({
        data: effectiveData,
        isLoading: shouldShowLoading,
        error: null,
      });

      let inflightEntry = this.inflight.get(key);
      if (options?.force && inflightEntry) {
        this.cancelInflight(key);
        inflightEntry = undefined;
      }

      if (!inflightEntry) {
        this.launchInflight(key, fetcher, options, 0);
      }
    }

    return () => {
      const activeListeners = this.listeners.get(key);
      if (activeListeners) {
        activeListeners.delete(sub);
        if (activeListeners.size === 0) {
          this.listeners.delete(key);
        }
        if (!this.hasRetainingListener(key)) {
          const currentInflight = this.inflight.get(key);
          if (currentInflight && currentInflight.imperativeCount === 0) {
            this.inflight.delete(key);
            currentInflight.controller.abort();
          }
        }
      }
    };
  }
}
