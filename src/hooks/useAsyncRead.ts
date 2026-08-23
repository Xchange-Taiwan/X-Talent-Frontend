'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  AsyncReadManager,
  AsyncReadOptions,
  AsyncReadResult,
} from '@/lib/asyncReadManager';

function getInitialResultState<K, V>(
  key: K | null | undefined,
  manager: AsyncReadManager<K, V>,
  initialData?: V
): AsyncReadResult<V> {
  if (key === null || key === undefined) {
    return { data: null, isLoading: false, error: null };
  }
  const cached = manager.get(key);
  if (cached !== undefined) {
    return {
      data: cached,
      isLoading: false,
      error: null,
    };
  }
  if (initialData !== undefined) {
    return {
      data: initialData,
      isLoading: false,
      error: null,
    };
  }
  return {
    data: null,
    isLoading: true,
    error: null,
  };
}

export function useAsyncRead<K, V>(
  manager: AsyncReadManager<K, V>,
  key: K | null | undefined,
  fetcher: (signal: AbortSignal, context?: { force?: boolean }) => Promise<V>,
  options?: AsyncReadOptions<K, V>
): AsyncReadResult<V> & { refetch: () => void } {
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [result, setResult] = useState<AsyncReadResult<V>>(() =>
    getInitialResultState(key, manager, options?.initialData)
  );

  const [prevKey, setPrevKey] = useState<K | null | undefined>(key);

  let currentResult = result;

  // Derived State Pattern: Synchronize state synchronously during render phase
  // on key changes, preventing stale state visual flicker/flashing and ensuring
  // that the correct reference is returned immediately during the active render cycle.
  if (prevKey !== key) {
    setPrevKey(key);
    currentResult = getInitialResultState(key, manager, options?.initialData);
    setResult(currentResult);
  }

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const lastRetryRef = useRef(0);

  useEffect(() => {
    if (key === null || key === undefined) {
      return;
    }

    const isForced = retryTrigger > lastRetryRef.current;
    lastRetryRef.current = retryTrigger;

    const currentOptions = isForced
      ? { ...optionsRef.current, force: true }
      : optionsRef.current;

    // Wrap state update with shallow-equality check (bailout on referential changes)
    // to prevent redundant and unnecessary re-renders of the component.
    const unsubscribe = manager.subscribe(
      key,
      (signal, context) => fetcherRef.current(signal, context),
      (newResult) => {
        setResult((prev) =>
          prev.data === newResult.data &&
          prev.isLoading === newResult.isLoading &&
          prev.error === newResult.error
            ? prev
            : newResult
        );
      },
      currentOptions
    );
    return () => {
      unsubscribe();
    };
  }, [manager, key, retryTrigger]);

  const refetch = useCallback(() => {
    setRetryTrigger((prev) => prev + 1);
  }, []);

  return useMemo(
    () => ({ ...currentResult, refetch }),
    [currentResult, refetch]
  );
}
