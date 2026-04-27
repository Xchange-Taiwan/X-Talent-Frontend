import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useWindowSize from './useWindowSize';

describe('useWindowSize', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.innerWidth = 1024;
    window.innerHeight = 768;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the current window size on mount', () => {
    const { result } = renderHook(() => useWindowSize());

    expect(result.current).toEqual({ width: 1024, height: 768 });
  });

  it('debounces resize updates and only commits the final size', () => {
    const { result } = renderHook(() => useWindowSize());

    act(() => {
      window.innerWidth = 800;
      window.dispatchEvent(new Event('resize'));
    });
    act(() => {
      window.innerWidth = 600;
      window.dispatchEvent(new Event('resize'));
    });
    act(() => {
      window.innerWidth = 480;
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.width).toBe(1024);

    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(result.current.width).toBe(1024);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.width).toBe(480);
  });

  it('clears pending timeout and removes listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { result, unmount } = renderHook(() => useWindowSize());

    act(() => {
      window.innerWidth = 500;
      window.dispatchEvent(new Event('resize'));
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.width).toBe(1024);
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
