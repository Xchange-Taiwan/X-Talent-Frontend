import { renderHook, waitFor } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCountries } from '@/services/profile/countries';
import type { LocationType } from '@/types/location';

import useLocations, {
  LOCATIONS_CACHE_TTL_MS,
  locationsReadManager,
} from './useLocations';

vi.mock('@/services/profile/countries', async () => {
  const actual = await vi.importActual<
    typeof import('@/services/profile/countries')
  >('@/services/profile/countries');
  return {
    ...actual,
    getCountries: vi.fn(),
  };
});

describe('useLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locationsReadManager.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches location data on mount and updates state', async () => {
    const mockData = [
      fromPartial<LocationType>({ value: 'TWN', text: 'Taiwan' }),
      fromPartial<LocationType>({ value: 'USA', text: 'United States' }),
    ];
    vi.mocked(getCountries).mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useLocations('zh_TW'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.locations).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.locations).toEqual(mockData);
    expect(getCountries).toHaveBeenCalledTimes(1);
    expect(getCountries).toHaveBeenCalledWith('zh_TW', expect.any(AbortSignal));
  });

  it('uses cached data synchronously on subsequent renders', async () => {
    const mockData = [
      fromPartial<LocationType>({ value: 'TWN', text: 'Taiwan' }),
    ];
    vi.mocked(getCountries).mockResolvedValueOnce(mockData);

    await locationsReadManager.prefetch('zh_TW', (signal) =>
      getCountries('zh_TW', signal)
    );

    const { result } = renderHook(() => useLocations('zh_TW'));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.locations).toEqual(mockData);
    expect(getCountries).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent calls for the same language key', async () => {
    const mockData = [
      fromPartial<LocationType>({ value: 'TWN', text: 'Taiwan' }),
    ];

    let resolveFetch: (value: LocationType[]) => void = () => {};
    const delayPromise = new Promise<LocationType[]>((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(getCountries).mockReturnValueOnce(delayPromise);

    const { result: r1 } = renderHook(() => useLocations('zh_TW'));
    const { result: r2 } = renderHook(() => useLocations('zh_TW'));

    expect(r1.current.isLoading).toBe(true);
    expect(r2.current.isLoading).toBe(true);

    resolveFetch(mockData);

    await waitFor(() => {
      expect(r1.current.isLoading).toBe(false);
      expect(r2.current.isLoading).toBe(false);
    });

    expect(r1.current.locations).toEqual(mockData);
    expect(r2.current.locations).toEqual(mockData);
    expect(getCountries).toHaveBeenCalledTimes(1);
  });

  it('handles fetch failures and allows subsequent retries', async () => {
    vi.mocked(getCountries).mockRejectedValueOnce(new Error('Fetch failed'));

    const { result, unmount } = renderHook(() => useLocations('zh_TW'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load location options');

    unmount();

    const mockData = [
      fromPartial<LocationType>({ value: 'TWN', text: 'Taiwan' }),
    ];
    vi.mocked(getCountries).mockResolvedValueOnce(mockData);

    const { result: retryResult } = renderHook(() => useLocations('zh_TW'));

    await waitFor(() => {
      expect(retryResult.current.isLoading).toBe(false);
    });

    expect(retryResult.current.locations).toEqual(mockData);
    expect(getCountries).toHaveBeenCalledTimes(2);
  });

  it('serves stale locations immediately without loading flash after TTL and revalidates in background', async () => {
    vi.useFakeTimers();

    const mockData1 = [
      fromPartial<LocationType>({ value: 'TWN', text: 'Taiwan' }),
    ];
    const mockData2 = [
      fromPartial<LocationType>({ value: 'USA', text: 'United States' }),
    ];

    vi.mocked(getCountries)
      .mockResolvedValueOnce(mockData1)
      .mockResolvedValueOnce(mockData2);

    const { result, unmount } = renderHook(() => useLocations('zh_TW'));

    expect(result.current.isLoading).toBe(true);

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.locations).toEqual(mockData1);
    expect(getCountries).toHaveBeenCalledTimes(1);

    unmount();

    vi.advanceTimersByTime(LOCATIONS_CACHE_TTL_MS + 1);

    const { result: retryResult } = renderHook(() => useLocations('zh_TW'));

    // Non-destructive SWR: stale mockData1 renders immediately with isLoading=false while revalidating
    expect(retryResult.current.isLoading).toBe(false);
    expect(retryResult.current.locations).toEqual(mockData1);
    expect(getCountries).toHaveBeenCalledTimes(2);

    await vi.waitFor(() => {
      expect(retryResult.current.locations).toEqual(mockData2);
    });
  });

  it('handles unmounting while a fetch is pending and prevents state updates', async () => {
    let resolveFetch: (value: LocationType[]) => void = () => {};
    const delayPromise = new Promise<LocationType[]>((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(getCountries).mockReturnValueOnce(delayPromise);

    const { result, unmount } = renderHook(() => useLocations('zh_TW'));

    expect(result.current.isLoading).toBe(true);

    unmount();

    const mockData = [
      fromPartial<LocationType>({ value: 'TWN', text: 'Taiwan' }),
    ];
    resolveFetch(mockData);

    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('correctly shifts state synchronously and triggers a new fetch when language prop changes', async () => {
    const zhData = [
      fromPartial<LocationType>({ value: 'TWN', text: 'Taiwan' }),
    ];
    const enData = [
      fromPartial<LocationType>({ value: 'USA', text: 'United States' }),
    ];

    vi.mocked(getCountries)
      .mockResolvedValueOnce(zhData)
      .mockResolvedValueOnce(enData);

    const { result, rerender } = renderHook((lang) => useLocations(lang), {
      initialProps: 'zh_TW',
    });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.locations).toEqual(zhData);
    expect(getCountries).toHaveBeenCalledTimes(1);
    expect(getCountries).toHaveBeenLastCalledWith(
      'zh_TW',
      expect.any(AbortSignal)
    );

    rerender('en_US');

    expect(result.current.isLoading).toBe(true);
    expect(result.current.locations).toEqual([]);
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.locations).toEqual(enData);
    expect(getCountries).toHaveBeenCalledTimes(2);
    expect(getCountries).toHaveBeenLastCalledWith(
      'en_US',
      expect.any(AbortSignal)
    );
  });

  it('clears the previous error state immediately when shifting to a cached language', async () => {
    const enData = [
      fromPartial<LocationType>({ value: 'USA', text: 'United States' }),
    ];
    locationsReadManager.set('en_US', enData);

    vi.mocked(getCountries).mockRejectedValueOnce(new Error('Fetch failed'));

    const { result, rerender } = renderHook((lang) => useLocations(lang), {
      initialProps: 'zh_TW',
    });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.error).toBe('Failed to load location options');

    rerender('en_US');

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.locations).toEqual(enData);
  });
});
