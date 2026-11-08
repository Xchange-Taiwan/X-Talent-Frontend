import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useKeyboardInset } from './useKeyboardInset';

const LAYOUT_HEIGHT = 800;

/**
 * 建立一個會真的保存 listener 的 visualViewport stub，讓測試可以在 hook 掛載後
 * 改變尺寸並派送事件。
 */
function stubVisualViewport({ keyboardHeight = 0, offsetTop = 0 } = {}) {
  const listeners = new Set<() => void>();
  const viewport = {
    height: LAYOUT_HEIGHT - keyboardHeight,
    offsetTop,
    addEventListener(_type: string, listener: () => void) {
      listeners.add(listener);
    },
    removeEventListener(_type: string, listener: () => void) {
      listeners.delete(listener);
    },
  };

  vi.stubGlobal('innerHeight', LAYOUT_HEIGHT);
  vi.stubGlobal('visualViewport', viewport);

  return {
    viewport,
    listenerCount: () => listeners.size,
    emit(next: { keyboardHeight?: number; offsetTop?: number } = {}): void {
      if (next.keyboardHeight !== undefined) {
        viewport.height = LAYOUT_HEIGHT - next.keyboardHeight;
      }
      if (next.offsetTop !== undefined) viewport.offsetTop = next.offsetTop;
      act(() => {
        listeners.forEach((listener) => listener());
      });
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useKeyboardInset', () => {
  it('measures the inset the keyboard leaves at the bottom of the layout viewport', () => {
    stubVisualViewport({ keyboardHeight: 300 });

    const { result } = renderHook(() => useKeyboardInset(true));

    expect(result.current).toEqual({ inset: 300, viewportHeight: 500 });
  });

  it('tracks offsetTop, which iOS changes when scrolling with the keyboard up', () => {
    const vv = stubVisualViewport({ keyboardHeight: 300 });
    const { result } = renderHook(() => useKeyboardInset(true));

    vv.emit({ offsetTop: 120 });

    // 800 - 500 - 120 = 180
    expect(result.current).toEqual({ inset: 180, viewportHeight: 500 });
  });

  it('re-reads on every visualViewport event while enabled', () => {
    const vv = stubVisualViewport({ keyboardHeight: 0 });
    const { result } = renderHook(() => useKeyboardInset(true));

    expect(result.current.inset).toBe(0);

    vv.emit({ keyboardHeight: 336 });
    expect(result.current).toEqual({ inset: 336, viewportHeight: 464 });

    vv.emit({ keyboardHeight: 0 });
    expect(result.current).toEqual({ inset: 0, viewportHeight: 800 });
  });

  it('does not re-render per event when the measurements have not changed', () => {
    const vv = stubVisualViewport({ keyboardHeight: 300 });

    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useKeyboardInset(true);
    });

    const settled = renders;
    const previous = result.current;

    // visualViewport 的 scroll 在行動裝置上觸發得非常密集，其中大多數並沒有改變
    // 任何量測值。
    for (let i = 0; i < 10; i += 1) vv.emit();

    // 回傳的物件參考必須原封不動，否則每個事件都會讓 SearchableSelect 跟著重新
    // 渲染。React 在短路之前允許多渲染一次，但之後就完全不再渲染 —— 重點是次數
    // 不會隨事件數量成長。
    expect(result.current).toBe(previous);
    expect(renders - settled).toBeLessThanOrEqual(1);
  });

  it('keeps the last measurement when disabled, so a closing sheet can finish its exit animation', () => {
    stubVisualViewport({ keyboardHeight: 300 });

    const { result, rerender } = renderHook(
      ({ enabled }) => useKeyboardInset(enabled),
      { initialProps: { enabled: true } }
    );

    expect(result.current.inset).toBe(300);

    rerender({ enabled: false });

    // 歸零會讓面板在退出動畫播完前就掉回畫面底部。
    expect(result.current).toEqual({ inset: 300, viewportHeight: 500 });
  });

  it('detaches its listeners when disabled and on unmount', () => {
    const vv = stubVisualViewport({ keyboardHeight: 300 });

    const { rerender, unmount } = renderHook(
      ({ enabled }) => useKeyboardInset(enabled),
      { initialProps: { enabled: true } }
    );

    expect(vv.listenerCount()).toBe(1);

    rerender({ enabled: false });
    expect(vv.listenerCount()).toBe(0);

    rerender({ enabled: true });
    expect(vv.listenerCount()).toBe(1);

    unmount();
    expect(vv.listenerCount()).toBe(0);
  });

  it('reports a zero inset where visualViewport is unavailable', () => {
    vi.stubGlobal('visualViewport', undefined);

    const { result } = renderHook(() => useKeyboardInset(true));

    expect(result.current).toEqual({ inset: 0, viewportHeight: 0 });
  });
});
