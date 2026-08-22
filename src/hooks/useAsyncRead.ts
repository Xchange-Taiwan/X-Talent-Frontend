'use client';

import { useEffect, useRef, useState } from 'react';

import type {
  AsyncReadManager,
  AsyncReadOptions,
  AsyncReadResult,
} from '@/lib/asyncReadManager';

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
