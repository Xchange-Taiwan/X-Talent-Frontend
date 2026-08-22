'use client';

import { useEffect, useRef, useState } from 'react';

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
  promise: Promise<V>;
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

  public has(key: K): boolean {
    return this.cache?.has(key) ?? false;
  }

  public clear(): void {
    this.cache?.clear();
    this.listeners.clear();
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
        const promise = Promise.resolve(fetcher(controller.signal)).then(
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
        );

        promise.catch(() => {});

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

export function useAsyncRead<K, V>(
  manager: AsyncReadManager<K, V>,
  key: K | null | undefined,
  fetcher: (signal: AbortSignal) => Promise<V>,
  options?: AsyncReadOptions<K, V>
): AsyncReadResult<V> {
  const [result, setResult] = useState<AsyncReadResult<V>>(() => {
    if (key === null || key === undefined) {
      return { data: null, isLoading: false, error: null };
    }
    const cached = manager.get(key);
    return {
      data: cached ?? null,
      isLoading: cached === undefined,
      error: null,
    };
  });

  const [prevKey, setPrevKey] = useState<K | null | undefined>(key);

  // Derived State Pattern: Synchronize state synchronously during render phase
  // on key changes, preventing stale state visual flicker/flashing
  if (prevKey !== key) {
    setPrevKey(key);
    if (key === null || key === undefined) {
      setResult({ data: null, isLoading: false, error: null });
    } else {
      const cached = manager.get(key);
      setResult({
        data: cached ?? null,
        isLoading: cached === undefined,
        error: null,
      });
    }
  }

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (key === null || key === undefined) {
      setResult({ data: null, isLoading: false, error: null });
      return;
    }

    const unsubscribe = manager.subscribe(
      key,
      (signal) => fetcherRef.current(signal),
      setResult,
      optionsRef.current
    );
    return () => {
      unsubscribe();
    };
  }, [manager, key]);

  return result;
}
