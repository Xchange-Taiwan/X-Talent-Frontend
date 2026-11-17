import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getLocations } from '@/lib/profile/locations';

import useLocations from './useLocations';

describe('useLocations', () => {
  it('returns populated zh_TW locations synchronously on the very first render with TWN pinned first', () => {
    const { result } = renderHook(() => useLocations('zh_TW'));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.locations).toBe(getLocations('zh_TW'));
    expect(result.current.locations[0]).toEqual({ value: 'TWN', text: '台灣' });
  });

  it('returns populated en_US locations synchronously on the very first render with TWN pinned first', () => {
    const { result } = renderHook(() => useLocations('en_US'));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.locations).toBe(getLocations('en_US'));
    expect(result.current.locations[0]).toEqual({
      value: 'TWN',
      text: 'Taiwan',
    });
  });

  it('switches locale synchronously without loading flash and preserves referential stability across re-renders', () => {
    const { result, rerender } = renderHook((lang) => useLocations(lang), {
      initialProps: 'zh_TW',
    });

    const firstZhResult = result.current;
    expect(firstZhResult.locations[0]).toEqual({ value: 'TWN', text: '台灣' });

    rerender('zh_TW');
    expect(result.current).toBe(firstZhResult);
    expect(result.current.locations).toBe(firstZhResult.locations);

    rerender('en_US');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.locations[0]).toEqual({
      value: 'TWN',
      text: 'Taiwan',
    });
  });
});
