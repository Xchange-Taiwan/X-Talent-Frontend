'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

const getServerSnapshot = (): boolean => false;

/**
 * 回報某個 media query 目前是否成立。
 *
 * 伺服器端沒有 viewport 可問，一律回 `false`，因此呼叫端要把「查詢不成立」設計成
 * 安全的預設值（通常是桌機版面）。也要留意 hydration 後才會拿到真實結果：不要讓
 * 這個值決定元件的樹狀結構，否則行動裝置上會發生一次卸載重掛。
 */
export function useMediaQuery(query: string): boolean {
  // 保留同一個 MediaQueryList 實例。getSnapshot 在每次 render 都會被呼叫，若在
  // 裡面重新 matchMedia，等於反覆解析字串並配置新物件，而且 subscribe 與
  // getSnapshot 會落在兩個不同的實例上。
  const mediaQueryList = useMemo(
    () =>
      typeof window === 'undefined' || typeof window.matchMedia !== 'function'
        ? null
        : window.matchMedia(query),
    [query]
  );

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!mediaQueryList) return () => {};
      mediaQueryList.addEventListener('change', onStoreChange);
      return () => mediaQueryList.removeEventListener('change', onStoreChange);
    },
    [mediaQueryList]
  );

  const getSnapshot = useCallback(
    () => mediaQueryList?.matches ?? false,
    [mediaQueryList]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
