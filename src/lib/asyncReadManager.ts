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
}

interface Subscription<V> {
  onUpdate: (result: AsyncReadResult<V>) => void;
  options?: AsyncReadOptions<unknown, V>;
}

interface InflightEntry<V> {
  promise: Promise<V | void>;
  controller: AbortController;
}

export class AsyncReadManager<K, V> {
  private cache?: KeyedCache<K, V>;
  private listeners = new Map<K, Set<Subscription<V>>>();
  private inflight = new Map<K, InflightEntry<V>>();

  constructor(cache?: KeyedCache<K, V>) {
    this.cache = cache;
  }

  public get(key: K): V | undefined {
    return this.cache?.get(key);
  }

  public set(key: K, value: V): void {
    if (this.cache) {
      this.cache.set(key, value);
    }
    const activeListeners = this.listeners.get(key);
    if (activeListeners) {
      activeListeners.forEach((listener) => {
        listener.onUpdate({
          data: value,
          isLoading: false,
          error: null,
        });
      });
    }
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
    fetcher: (signal: AbortSignal) => Promise<V>,
    onUpdate: (result: AsyncReadResult<V>) => void,
    options?: AsyncReadOptions<K, V>
  ): () => void {
    const cached = this.cache?.get(key);
    const hasCache = cached !== undefined;

    const sub: Subscription<V> = { onUpdate, options };
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set<Subscription<V>>();
      this.listeners.set(key, set);
    }
    set.add(sub);

    if (hasCache && !options?.force) {
      // Synchronous update for cache hit
      onUpdate({ data: cached, isLoading: false, error: null });
    } else {
      // Inform of loading state
      onUpdate({ data: cached ?? null, isLoading: true, error: null });

      let inflightEntry = this.inflight.get(key);
      if (options?.force && inflightEntry) {
        // Force refresh: abort current in-flight fetch and start fresh
        inflightEntry.controller.abort();
        this.inflight.delete(key);
        inflightEntry = undefined;
      }

      if (!inflightEntry) {
        const controller = new AbortController();
        const promise = Promise.resolve(fetcher(controller.signal))
          .then(
            (value) => {
              if (controller.signal.aborted) {
                return value;
              }
              if (this.cache) {
                this.cache.set(key, value, options?.ttlMs);
              }
              if (this.inflight.get(key)?.controller === controller) {
                this.inflight.delete(key);
              }

              const activeListeners = this.listeners.get(key);
              if (activeListeners) {
                activeListeners.forEach((listener) => {
                  listener.onUpdate({
                    data: value,
                    isLoading: false,
                    error: null,
                  });
                });
              }
              return value;
            },
            (err) => {
              if (this.inflight.get(key)?.controller === controller) {
                this.inflight.delete(key);
              }
              if (
                controller.signal.aborted ||
                (err instanceof Error && err.name === 'AbortError')
              ) {
                throw err;
              }
              const activeListeners = this.listeners.get(key);
              if (activeListeners) {
                activeListeners.forEach((listener) => {
                  listener.onUpdate({
                    data: this.cache?.get(key) ?? null,
                    isLoading: false,
                    error: err instanceof Error ? err.message : String(err),
                  });
                });
              }
              throw err;
            }
          )
          .catch(() => {
            // Swallow handled rejection locally to prevent Unhandled Promise Rejection warnings
          });

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
