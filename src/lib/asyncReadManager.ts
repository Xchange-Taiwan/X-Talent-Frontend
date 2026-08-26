import type { KeyedCache } from '@/lib/createKeyedCache';

export interface AsyncReadResult<V> {
  data: V | null;
  isLoading: boolean;
  error: string | null;
}

export interface AsyncReadOptions<K, V> {
  cache?: KeyedCache<K, V>;
  ttlMs?: number;
  force?: boolean;
  initialData?: V;
  shouldCache?: (value: V) => boolean;
}

interface Subscription<V> {
  onUpdate: (result: AsyncReadResult<V>) => void;
  options?: AsyncReadOptions<unknown, V>;
}

interface InflightEntry<V> {
  promise: Promise<V | void>;
  controller: AbortController;
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
  set(key: K, value: V, ttlMs?: number): void;
  subscribe(
    key: K,
    fetcher: (signal: AbortSignal, context?: { force?: boolean }) => Promise<V>,
    onUpdate: (result: AsyncReadResult<V>) => void,
    options?: AsyncReadOptions<K, V>
  ): () => void;
}

export class AsyncReadManager<K, V> implements AsyncReadSource<K, V> {
  private cache?: KeyedCache<K, V>;
  private listeners = new Map<K, Set<Subscription<V>>>();
  private inflight = new Map<K, InflightEntry<V>>();

  constructor(cache?: KeyedCache<K, V>) {
    this.cache = cache;
  }

  private cancelInflight(key: K): void {
    const entry = this.inflight.get(key);
    if (entry) {
      entry.controller.abort();
      this.inflight.delete(key);
    }
  }

  private notifyListeners(key: K, result: AsyncReadResult<V>): void {
    const activeListeners = this.listeners.get(key);
    if (activeListeners) {
      activeListeners.forEach((listener) => listener.onUpdate(result));
    }
  }

  public get(key: K): V | undefined {
    return this.cache?.get(key);
  }

  public set(key: K, value: V, ttlMs?: number): void {
    // A write always wins over whatever fetch is in flight for this key,
    // otherwise a late response can resolve after the write and clobber it.
    this.cancelInflight(key);
    if (this.cache) {
      this.cache.set(key, value, ttlMs);
    }
    this.notifyListeners(key, { data: value, isLoading: false, error: null });
  }

  /**
   * Update the value at `key` derived from its current cached value.
   * Returning `undefined` from `updater` is a no-op (nothing to update from).
   */
  public update(
    key: K,
    updater: (current: V | undefined) => V | undefined,
    ttlMs?: number
  ): void {
    const next = updater(this.cache?.get(key));
    if (next === undefined) {
      return;
    }
    this.set(key, next, ttlMs);
  }

  /** Drop the cached value at `key` and cancel any fetch in flight for it. */
  public invalidate(key: K): void {
    this.cancelInflight(key);
    if (this.cache) {
      this.cache.delete(key);
    }
    this.notifyListeners(key, { data: null, isLoading: false, error: null });
  }

  public has(key: K): boolean {
    return this.cache?.has(key) ?? false;
  }

  public getInflightCount(): number {
    return this.inflight.size;
  }

  public getListenerCount(key: K): number {
    return this.listeners.get(key)?.size ?? 0;
  }

  public clear(): void {
    this.cache?.clear();
    this.listeners.clear();
    this.inflight.forEach((entry) => entry.controller.abort());
    this.inflight.clear();
  }

  public subscribe(
    key: K,
    fetcher: (signal: AbortSignal, context?: { force?: boolean }) => Promise<V>,
    onUpdate: (result: AsyncReadResult<V>) => void,
    options?: AsyncReadOptions<K, V>
  ): () => void {
    const cachedStatus = this.cache?.getWithStatus(key);
    const cached = cachedStatus?.value;
    const isStale = cachedStatus?.isStale ?? false;
    const hasCache = cached !== undefined;

    const hasInitialData = options?.initialData !== undefined;
    const effectiveData =
      cached !== undefined
        ? cached
        : hasInitialData
          ? options!.initialData!
          : null;

    const sub: Subscription<V> = { onUpdate, options };
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set<Subscription<V>>();
      this.listeners.set(key, set);
    }
    set.add(sub);

    if (hasCache && !options?.force && !isStale) {
      // Synchronous update for cache hit
      onUpdate({ data: cached, isLoading: false, error: null });
    } else {
      // Inform of loading state (only blocking if no cache and no initialData, or if we force a refresh)
      const shouldShowLoading =
        (!hasCache && !hasInitialData) || !!options?.force;
      onUpdate({
        data: effectiveData,
        isLoading: shouldShowLoading,
        error: null,
      });

      let inflightEntry = this.inflight.get(key);
      if (options?.force && inflightEntry) {
        // Force refresh: abort current in-flight fetch and start fresh
        this.cancelInflight(key);
        inflightEntry = undefined;
      }

      if (!inflightEntry) {
        const controller = new AbortController();
        const force = !!options?.force;
        // Never rejects: callers only ever read `controller`/`promise` for
        // bookkeeping (nothing awaits this promise), so both branches below
        // resolve rather than throw once they've done their notifying. That
        // also means there's no throw-then-catch to trace through to see
        // this doesn't produce an unhandled rejection.
        const promise = Promise.resolve(
          fetcher(controller.signal, { force })
        ).then(
          (value) => {
            // Guards against a fetcher that ignores the AbortSignal and
            // resolves anyway: abort() flags the signal synchronously, and
            // any write (set/update/invalidate) that superseded this fetch
            // already ran to completion before this callback was queued,
            // so the flag is guaranteed visible here.
            if (controller.signal.aborted) {
              return value;
            }
            if (this.cache) {
              if (!options?.shouldCache || options.shouldCache(value)) {
                this.cache.set(key, value, options?.ttlMs);
              }
            }
            if (this.inflight.get(key)?.controller === controller) {
              this.inflight.delete(key);
            }

            this.notifyListeners(key, {
              data: value,
              isLoading: false,
              error: null,
            });
            return value;
          },
          (err) => {
            if (this.inflight.get(key)?.controller === controller) {
              this.inflight.delete(key);
            }
            // Only *our own* abort counts as routine cancellation. Do not
            // also match on `err.name === 'AbortError'`: a fetcher can
            // reject with that name for a reason unrelated to us (e.g. its
            // own internal timeout signal), and treating that as routine
            // would swallow a real failure, leaving subscribers stuck on
            // isLoading: true forever since notifyListeners below would
            // never run for it.
            if (controller.signal.aborted) {
              return;
            }
            const currentCacheStatus = this.cache?.getWithStatus(key);
            const fallbackData =
              currentCacheStatus !== undefined
                ? currentCacheStatus.value
                : options?.initialData !== undefined
                  ? options.initialData
                  : null;

            this.notifyListeners(key, {
              data: fallbackData,
              isLoading: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        );

        const entry: InflightEntry<V> = { promise, controller };
        inflightEntry = entry;
        this.inflight.set(key, entry);
      }
    }

    return () => {
      const activeListeners = this.listeners.get(key);
      if (activeListeners) {
        activeListeners.delete(sub);
        if (activeListeners.size === 0) {
          this.listeners.delete(key);
          const currentInflight = this.inflight.get(key);
          if (currentInflight) {
            currentInflight.controller.abort();
            this.inflight.delete(key);
          }
        }
      }
    };
  }
}
