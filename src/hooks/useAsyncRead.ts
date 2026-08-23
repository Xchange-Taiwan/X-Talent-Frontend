'use client';

import { useEffect, useRef, useState } from 'react';

import type {
  AsyncReadManager,
  AsyncReadOptions,
  AsyncReadResult,
} from '@/lib/asyncReadManager';

function getInitialResultState<K, V>(
  key: K | null | undefined,
  manager: AsyncReadManager<K, V>
): AsyncReadResult<V> {
  if (key === null || key === undefined) {
    return { data: null, isLoading: false, error: null };
  }
  const cached = manager.get(key);
  return {
    data: cached ?? null,
    isLoading: cached === undefined,
    error: null,
  };
}

export function useAsyncRead<K, V>(
  manager: AsyncReadManager<K, V>,
  key: K | null | undefined,
  fetcher: (signal: AbortSignal) => Promise<V>,
  options?: AsyncReadOptions<K, V>
): AsyncReadResult<V> {
  const [result, setResult] = useState<AsyncReadResult<V>>(() =>
    getInitialResultState(key, manager)
  );

  const [prevKey, setPrevKey] = useState<K | null | undefined>(key);

  let currentResult = result;

  // Derived State Pattern: Synchronize state synchronously during render phase
  // on key changes, preventing stale state visual flicker/flashing and ensuring
  // that the correct reference is returned immediately during the active render cycle.
  if (prevKey !== key) {
    setPrevKey(key);
    currentResult = getInitialResultState(key, manager);
    setResult(currentResult);
  }

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (key === null || key === undefined) {
      return;
    }

    // Wrap state update with shallow-equality check (bailout on referential changes)
    // to prevent redundant and unnecessary re-renders of the component.
    const unsubscribe = manager.subscribe(
      key,
      (signal) => fetcherRef.current(signal),
      (newResult) => {
        setResult((prev) =>
          prev.data === newResult.data &&
          prev.isLoading === newResult.isLoading &&
          prev.error === newResult.error
            ? prev
            : newResult
        );
      },
      optionsRef.current
    );
    return () => {
      unsubscribe();
    };
  }, [manager, key]);

  return currentResult;
}
