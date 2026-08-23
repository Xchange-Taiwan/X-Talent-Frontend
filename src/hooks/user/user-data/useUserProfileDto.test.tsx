import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchUserById } from '@/services/profile/user';
import { mockUserDTO } from '@/test/fixtures/profile';

import {
  clearUserProfileDtoCache,
  primeUserProfileDtoCache,
  useUserProfileDto,
} from './useUserProfileDto';

vi.mock('@/services/profile/user', () => ({
  fetchUserById: vi.fn(),
}));

describe('useUserProfileDto', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches user profile DTO and updates state', async () => {
    vi.mocked(fetchUserById).mockResolvedValueOnce(mockUserDTO);

    const { result } = renderHook(() => useUserProfileDto(1, 'zh-TW'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.userDto).toBeNull();

    // Advance timer or await promise to resolve
    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.userDto).toEqual(mockUserDTO);
    expect(fetchUserById).toHaveBeenCalledWith(1, 'zh-TW');
    expect(fetchUserById).toHaveBeenCalledTimes(1);
  });

  it('uses cached DTO with stale checking (SWR)', async () => {
    vi.mocked(fetchUserById).mockResolvedValue(mockUserDTO);

    // Prime cache first
    primeUserProfileDtoCache(1, 'zh-TW', mockUserDTO);

    const { result } = renderHook(() => useUserProfileDto(1, 'zh-TW'));

    // Should load synchronously and isLoading should be false immediately
    expect(result.current.isLoading).toBe(false);
    expect(result.current.userDto).toEqual(mockUserDTO);
    expect(fetchUserById).not.toHaveBeenCalled();

    // Fast-forward past TTL (60,000 ms)
    vi.advanceTimersByTime(60001);

    const { result: staleResult } = renderHook(() =>
      useUserProfileDto(1, 'zh-TW')
    );

    // With SWR, it should STILL render mockUserDTO immediately with isLoading=false
    expect(staleResult.current.isLoading).toBe(false);
    expect(staleResult.current.userDto).toEqual(mockUserDTO);

    // But it should trigger a background refetch
    expect(fetchUserById).toHaveBeenCalledTimes(1);
  });

  it('allows clearing the cache and forcing refetch', async () => {
    vi.mocked(fetchUserById).mockResolvedValue(mockUserDTO);

    primeUserProfileDtoCache(1, 'zh-TW', mockUserDTO);
    clearUserProfileDtoCache(1, 'zh-TW');

    const { result } = renderHook(() => useUserProfileDto(1, 'zh-TW'));

    // Cache is cleared, so it must do a blocking load (isLoading = true initially)
    expect(result.current.isLoading).toBe(true);
  });

  it('handles fetch failures and allows subsequent retries', async () => {
    vi.mocked(fetchUserById).mockRejectedValueOnce(new Error('API error'));

    // First call: should fail with error message
    const { result, unmount } = renderHook(() => useUserProfileDto(2, 'zh-TW'));

    expect(result.current.isLoading).toBe(true);

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('FETCH_FAILED');

    // Unmount so we can retry from fresh mount
    unmount();

    // Second call: should retry since inflight was cleaned up
    vi.mocked(fetchUserById).mockResolvedValueOnce(mockUserDTO);

    const { result: retryResult } = renderHook(() =>
      useUserProfileDto(2, 'zh-TW')
    );

    await vi.waitFor(() => {
      expect(retryResult.current.isLoading).toBe(false);
    });

    expect(retryResult.current.userDto).toEqual(mockUserDTO);
    expect(fetchUserById).toHaveBeenCalledTimes(2);
  });

  it('provides a refetch function that clears cache and forces refetch', async () => {
    vi.mocked(fetchUserById).mockResolvedValueOnce(mockUserDTO);

    const { result } = renderHook(() => useUserProfileDto(3, 'zh-TW'));

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.userDto).toEqual(mockUserDTO);
    expect(fetchUserById).toHaveBeenCalledTimes(1);

    // Call refetch
    vi.mocked(fetchUserById).mockResolvedValueOnce({
      ...mockUserDTO,
      name: 'Updated Name',
    });
    result.current.refetch?.();

    await vi.waitFor(() => {
      expect(result.current.userDto?.name).toBe('Updated Name');
    });

    expect(fetchUserById).toHaveBeenCalledTimes(2);
  });

  it('correctly sets error state to Failed to load user data when fetchUserById throws/rejects', async () => {
    vi.mocked(fetchUserById).mockRejectedValueOnce(new Error('API error'));

    const { result } = renderHook(() => useUserProfileDto(4, 'zh-TW'));

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('FETCH_FAILED');
    expect(result.current.userDto).toBeNull();
  });

  describe('initialData (SSR hydration)', () => {
    it('seeds userDto synchronously and skips the initial fetch when initialData is a real DTO', () => {
      const ssrDto = { ...mockUserDTO, name: 'SSR Seeded' };

      const { result } = renderHook(() =>
        useUserProfileDto(5, 'zh-TW', ssrDto)
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.userDto).toEqual(ssrDto);
      expect(fetchUserById).not.toHaveBeenCalled();
    });

    it('warms the shared cache from initialData after mount (client-only), so a later mount for the same key skips the fetch too', async () => {
      const ssrDto = { ...mockUserDTO, name: 'SSR Seeded 2' };

      const { result, unmount } = renderHook(() =>
        useUserProfileDto(6, 'zh-TW', ssrDto)
      );
      expect(result.current.userDto).toEqual(ssrDto);
      unmount();

      const { result: second } = renderHook(() =>
        useUserProfileDto(6, 'zh-TW')
      );

      expect(second.current.isLoading).toBe(false);
      expect(second.current.userDto).toEqual(ssrDto);
      expect(fetchUserById).not.toHaveBeenCalled();
    });

    it('treats initialData: null exactly like no initialData was passed (falls through to a real fetch)', async () => {
      vi.mocked(fetchUserById).mockResolvedValueOnce(mockUserDTO);

      const { result } = renderHook(() => useUserProfileDto(7, 'zh-TW', null));

      expect(result.current.isLoading).toBe(true);

      await vi.waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.userDto).toEqual(mockUserDTO);
      expect(fetchUserById).toHaveBeenCalledWith(7, 'zh-TW');
    });

    it('prioritizes client-side primed cache over initialData and keeps isLoading false', () => {
      const primedDto = { ...mockUserDTO, name: 'Cache Primed' };
      primeUserProfileDtoCache(10, 'zh-TW', primedDto);

      const ssrDto = { ...mockUserDTO, name: 'Stale SSR' };

      const { result } = renderHook(() =>
        useUserProfileDto(10, 'zh-TW', ssrDto)
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.userDto).toEqual(primedDto);
      expect(fetchUserById).not.toHaveBeenCalled();
    });
  });

  describe('options.enabled === false', () => {
    it('does not trigger API fetch and renders null when cache is empty', () => {
      const { result } = renderHook(() =>
        useUserProfileDto(8, 'zh-TW', undefined, { enabled: false })
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.userDto).toBeNull();
      expect(fetchUserById).not.toHaveBeenCalled();
    });

    it('renders from cache synchronously and does not fetch when cache is primed', () => {
      const primedDto = { ...mockUserDTO, name: 'Cache Primed' };
      primeUserProfileDtoCache(9, 'zh-TW', primedDto);

      const { result } = renderHook(() =>
        useUserProfileDto(9, 'zh-TW', undefined, { enabled: false })
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.userDto).toEqual(primedDto);
      expect(fetchUserById).not.toHaveBeenCalled();
    });
  });
});
