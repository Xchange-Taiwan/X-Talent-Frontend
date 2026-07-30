import { renderHook, waitFor } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCountries, LocationType } from '@/services/profile/countries';

import useLocations, { locationsCache } from './useLocations';

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
    locationsCache.clear();
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
    expect(getCountries).toHaveBeenCalledWith('zh_TW');
  });

  it('uses cached data synchronously on subsequent renders', async () => {
    const mockData = [
      fromPartial<LocationType>({ value: 'TWN', text: 'Taiwan' }),
    ];
    vi.mocked(getCountries).mockResolvedValueOnce(mockData);

    // Warm the cache
    await locationsCache.fetch('zh_TW', () => getCountries('zh_TW'));

    const { result } = renderHook(() => useLocations('zh_TW'));

    // Should load synchronously from cache (isLoading = false initially)
    expect(result.current.isLoading).toBe(false);
    expect(result.current.locations).toEqual(mockData);
    expect(getCountries).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent calls for the same language key', async () => {
    const mockData = [
      fromPartial<LocationType>({ value: 'TWN', text: 'Taiwan' }),
    ];

    // Controlled unresolved promise to mimic concurrent requests
    let resolveFetch: (value: LocationType[]) => void = () => {};
    const delayPromise = new Promise<LocationType[]>((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(getCountries).mockReturnValueOnce(delayPromise);

    // Render hook multiple times concurrently
    const { result: r1 } = renderHook(() => useLocations('zh_TW'));
    const { result: r2 } = renderHook(() => useLocations('zh_TW'));

    expect(r1.current.isLoading).toBe(true);
    expect(r2.current.isLoading).toBe(true);

    // Resolve the single promise
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

    // Unmount so we can remount and trigger a fresh fetch
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

  it('correctly expires the cache after TTL and triggers a new fetch', async () => {
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

    // Initial render and fetch
    const { result, unmount } = renderHook(() => useLocations('zh_TW'));

    expect(result.current.isLoading).toBe(true);

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.locations).toEqual(mockData1);
    expect(getCountries).toHaveBeenCalledTimes(1);

    // Unmount so we can test next mounting
    unmount();

    // Fast-forward time past 24 hours (24 * 60 * 60 * 1000)
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);

    // Remount the hook for the same language
    const { result: retryResult } = renderHook(() => useLocations('zh_TW'));

    // Cache should be expired, so it should load and fetch again
    expect(retryResult.current.isLoading).toBe(true);

    await vi.waitFor(() => {
      expect(retryResult.current.isLoading).toBe(false);
    });

    expect(retryResult.current.locations).toEqual(mockData2);
    expect(getCountries).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('handles unmounting while a fetch is pending and prevents state updates', async () => {
    let resolveFetch: (value: LocationType[]) => void = () => {};
    const delayPromise = new Promise<LocationType[]>((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(getCountries).mockReturnValueOnce(delayPromise);

    const { result, unmount } = renderHook(() => useLocations('zh_TW'));

    expect(result.current.isLoading).toBe(true);

    // Unmount while the promise is still pending
    unmount();

    // Resolve the promise now that the hook is unmounted
    const mockData = [
      fromPartial<LocationType>({ value: 'TWN', text: 'Taiwan' }),
    ];
    resolveFetch(mockData);

    // Give microtasks a chance to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The test should pass without any React warnings or errors
  });
});
