import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useMediaQuery } from './useMediaQuery';

/**
 * 建立一個可控的 matchMedia stub，記錄下每次呼叫用的 query、保存 listener，
 * 並且可以在掛載後翻轉比對結果。
 */
function stubMatchMedia({ matches = false } = {}) {
  const listeners = new Set<() => void>();
  const queries: string[] = [];
  let current = matches;

  const list = {
    get matches() {
      return current;
    },
    addEventListener(_type: string, listener: () => void) {
      listeners.add(listener);
    },
    removeEventListener(_type: string, listener: () => void) {
      listeners.delete(listener);
    },
  };

  vi.stubGlobal('matchMedia', (query: string) => {
    queries.push(query);
    return list as unknown as MediaQueryList;
  });

  return {
    queries,
    listenerCount: () => listeners.size,
    /** 翻轉比對結果並派送 change 事件，模擬視窗跨過斷點。 */
    set(next: boolean): void {
      current = next;
      act(() => {
        listeners.forEach((listener) => listener());
      });
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMediaQuery', () => {
  it('reports whether the query matches', () => {
    stubMatchMedia({ matches: true });

    const { result } = renderHook(() => useMediaQuery('(max-width: 639.98px)'));

    expect(result.current).toBe(true);
  });

  it('updates when the viewport crosses the breakpoint', () => {
    const mq = stubMatchMedia({ matches: false });
    const { result } = renderHook(() => useMediaQuery('(max-width: 639.98px)'));

    expect(result.current).toBe(false);

    mq.set(true);
    expect(result.current).toBe(true);

    mq.set(false);
    expect(result.current).toBe(false);
  });

  it('reuses one MediaQueryList instead of rebuilding it on every render', () => {
    const mq = stubMatchMedia({ matches: true });
    const { result, rerender } = renderHook(() =>
      useMediaQuery('(max-width: 639.98px)')
    );

    const callsAfterMount = mq.queries.length;

    rerender();
    rerender();
    rerender();

    // getSnapshot 讀的是既有實例的 matches，不會每次 render 都重新 matchMedia。
    expect(mq.queries.length).toBe(callsAfterMount);
    expect(result.current).toBe(true);
  });

  it('rebuilds and resubscribes when the query itself changes', () => {
    const mq = stubMatchMedia({ matches: true });
    const { rerender } = renderHook(({ query }) => useMediaQuery(query), {
      initialProps: { query: '(max-width: 639.98px)' },
    });

    rerender({ query: '(min-width: 1024px)' });

    expect(mq.queries).toContain('(max-width: 639.98px)');
    expect(mq.queries).toContain('(min-width: 1024px)');
    expect(mq.listenerCount()).toBe(1);
  });

  it('detaches its listener on unmount', () => {
    const mq = stubMatchMedia({ matches: true });
    const { unmount } = renderHook(() =>
      useMediaQuery('(max-width: 639.98px)')
    );

    expect(mq.listenerCount()).toBe(1);

    unmount();
    expect(mq.listenerCount()).toBe(0);
  });

  it('falls back to false where matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);

    const { result } = renderHook(() => useMediaQuery('(max-width: 639.98px)'));

    expect(result.current).toBe(false);
  });
});
