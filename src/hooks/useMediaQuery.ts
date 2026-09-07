'use client';

import { useCallback, useSyncExternalStore } from 'react';

const getServerSnapshot = (): boolean => false;

/**
 * 回報某個 media query 目前是否成立。
 *
 * 伺服器端沒有 viewport 可問，一律回 `false`，因此呼叫端要把「查詢不成立」設計成
 * 安全的預設值（通常是桌機版面）。
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onStoreChange);
      return () => list.removeEventListener('change', onStoreChange);
    },
    [query]
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
