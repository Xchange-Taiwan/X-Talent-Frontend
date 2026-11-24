import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { profileReadModel } from '@/lib/profile/profileReadModel';
import { fetchUserById } from '@/services/profile/user';
import { mockUserDTO } from '@/test/fixtures/profile';

import { hasDtoConverged, useUserProfileDto } from './useUserProfileDto';

vi.mock('@/services/profile/user', () => ({
  fetchUserById: vi.fn(),
}));

describe('useUserProfileDto', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    profileReadModel.clear();
  });

  afterEach(() => {
    profileReadModel.clear();
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
    expect(fetchUserById).toHaveBeenCalledWith(
      1,
      'zh-TW',
      expect.any(AbortSignal)
    );
    expect(fetchUserById).toHaveBeenCalledTimes(1);
  });

  it('uses cached DTO with stale checking (SWR)', async () => {
    vi.mocked(fetchUserById).mockResolvedValue(mockUserDTO);

    // Prime cache first
    profileReadModel.prime({ userId: 1, language: 'zh-TW' }, mockUserDTO);

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

    profileReadModel.prime({ userId: 1, language: 'zh-TW' }, mockUserDTO);
    profileReadModel.invalidate({ userId: 1, language: 'zh-TW' });

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

  it('retains stale cache data if background revalidation returns null', async () => {
    vi.mocked(fetchUserById).mockResolvedValueOnce(mockUserDTO);

    // Initial fetch to populate cache
    const { result } = renderHook(() => useUserProfileDto(10, 'zh-TW'));
    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.userDto).toEqual(mockUserDTO);

    // Fast-forward past TTL (60,000 ms)
    vi.advanceTimersByTime(60001);

    // Trigger background update by mounting/rendering again on same key
    vi.mocked(fetchUserById).mockResolvedValueOnce(null); // Resolves null in background

    const { result: staleResult } = renderHook(() =>
      useUserProfileDto(10, 'zh-TW')
    );

    // Should return stale data immediately
    expect(staleResult.current.userDto).toEqual(mockUserDTO);

    // Let the background promise resolve
    await vi.waitFor(() => {
      expect(fetchUserById).toHaveBeenCalledTimes(2);
    });

    // Stale data should still be retained
    expect(staleResult.current.userDto).toEqual(mockUserDTO);
  });

  it('correctly maps error to USER_NOT_FOUND when fetchUserById resolves null (user does not exist)', async () => {
    vi.mocked(fetchUserById).mockResolvedValueOnce(null);

    const { result } = renderHook(() => useUserProfileDto(11, 'zh-TW'));

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('USER_NOT_FOUND');
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

    it('seeds userDto as null synchronously and skips the initial fetch when initialData is null (USER_NOT_FOUND), while allowing manual refetch to recover', async () => {
      const { result } = renderHook(() => useUserProfileDto(7, 'zh-TW', null));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.userDto).toBeNull();
      expect(result.current.error).toBe('USER_NOT_FOUND');
      expect(fetchUserById).not.toHaveBeenCalled();

      vi.mocked(fetchUserById).mockResolvedValueOnce(mockUserDTO);
      act(() => {
        result.current.refetch?.();
      });

      await vi.waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.userDto).toEqual(mockUserDTO);
      });

      expect(result.current.error).toBeNull();
      expect(fetchUserById).toHaveBeenCalledTimes(1);
    });

    it('prioritizes client-side cache over SSR initialData to prevent regression/flash to old SSR data during transition', () => {
      const cachedDto = { ...mockUserDTO, name: 'Cache Authoritative' };
      const oldSsrDto = { ...mockUserDTO, name: 'Old SSR' };

      // Prime the client-side cache (e.g. from a successful saveProfile)
      profileReadModel.prime({ userId: 8, language: 'zh-TW' }, cachedDto);

      // Now a component mounts receiving a stale oldSsrDto from SSR (e.g. during navigation hydration)
      const { result } = renderHook(() =>
        useUserProfileDto(8, 'zh-TW', oldSsrDto)
      );

      // The hook must prioritize the client-side cached data (which is newer) over the old initialData
      expect(result.current.isLoading).toBe(false);
      expect(result.current.userDto).toEqual(cachedDto);
      expect(fetchUserById).not.toHaveBeenCalled();
    });
  });

  describe('options.enabled', () => {
    it('does not fetch or set loading to true when enabled: false, reading only from cache if present', async () => {
      const cachedDto = { ...mockUserDTO, name: 'Cached DTO' };
      profileReadModel.prime({ userId: 9, language: 'zh-TW' }, cachedDto);

      // Mount with enabled: false and a valid cache entry
      const { result } = renderHook(() =>
        useUserProfileDto(9, 'zh-TW', undefined, { enabled: false })
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.userDto).toEqual(cachedDto);
      expect(fetchUserById).not.toHaveBeenCalled();

      // Mount with enabled: false but NO cache entry
      const { result: emptyResult } = renderHook(() =>
        useUserProfileDto(12, 'zh-TW', undefined, { enabled: false })
      );

      expect(emptyResult.current.isLoading).toBe(false);
      expect(emptyResult.current.userDto).toBeNull();
      expect(fetchUserById).not.toHaveBeenCalled();
    });
  });

  describe('getLastPrimedTime', () => {
    it('returns the timestamp of the last primed cache operation', () => {
      // Setup system time
      const mockTime = 1234567890000;
      vi.setSystemTime(mockTime);

      profileReadModel.prime({ userId: 99, language: 'zh-TW' }, mockUserDTO);

      expect(profileReadModel.getLastPrimedTime()).toBe(mockTime);
    });
  });

  it('clears cache and sets error to USER_NOT_FOUND if API returns null during manual refetch', async () => {
    vi.mocked(fetchUserById).mockResolvedValueOnce(mockUserDTO);

    // Initial fetch to populate cache
    const { result, unmount } = renderHook(() =>
      useUserProfileDto(20, 'zh-TW')
    );
    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.userDto).toEqual(mockUserDTO);

    // Manual refetch returns null (user deleted)
    vi.mocked(fetchUserById).mockResolvedValueOnce(null);

    act(() => {
      result.current.refetch?.();
    });

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.userDto).toBeNull();
    expect(result.current.error).toBe('USER_NOT_FOUND');
    unmount();
  });

  it('clears cache and sets error to FETCH_FAILED if API throws error during manual refetch', async () => {
    vi.mocked(fetchUserById).mockResolvedValueOnce(mockUserDTO);

    // Initial fetch to populate cache
    const { result, unmount } = renderHook(() =>
      useUserProfileDto(21, 'zh-TW')
    );
    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.userDto).toEqual(mockUserDTO);

    // Manual refetch throws error
    vi.mocked(fetchUserById).mockRejectedValueOnce(new Error('Network error'));

    act(() => {
      result.current.refetch?.();
    });

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.userDto).toBeNull();
    expect(result.current.error).toBe('FETCH_FAILED');
    unmount();
  });

  it('retains stale cache data silently if background revalidation throws error', async () => {
    vi.mocked(fetchUserById).mockResolvedValueOnce(mockUserDTO);

    // Initial fetch to populate cache
    const { result, unmount } = renderHook(() =>
      useUserProfileDto(22, 'zh-TW')
    );
    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.userDto).toEqual(mockUserDTO);

    // Fast-forward past TTL (60,000 ms)
    vi.advanceTimersByTime(60001);

    // Trigger background update by mounting/rendering again on same key
    vi.mocked(fetchUserById).mockRejectedValueOnce(new Error('Network error')); // Throws in background

    const { result: staleResult, unmount: unmountStale } = renderHook(() =>
      useUserProfileDto(22, 'zh-TW')
    );

    // Should return stale data immediately
    expect(staleResult.current.userDto).toEqual(mockUserDTO);

    // Let the background promise resolve/fail
    await vi.waitFor(() => {
      expect(fetchUserById).toHaveBeenCalledTimes(2);
    });

    // Stale data should still be retained and error remains null (graceful SWR error fallback)
    expect(staleResult.current.userDto).toEqual(mockUserDTO);
    expect(staleResult.current.error).toBeNull();

    unmount();
    unmountStale();
  });

  it('retains primed optimistic DTO during the transition window when background revalidation returns a non-converged stale DTO (#785)', async () => {
    const primedDto = {
      ...mockUserDTO,
      name: 'Optimistic Updated Name',
      job_title: 'Principal Engineer',
      company: 'New Corp',
      is_mentor: true,
    };
    const staleBackendDto = {
      ...mockUserDTO,
      name: 'Old Stale Name',
      job_title: 'Junior Engineer',
      company: 'Old Corp',
      is_mentor: false,
    };

    vi.mocked(fetchUserById).mockReset();
    vi.mocked(fetchUserById).mockResolvedValueOnce(staleBackendDto);

    // 1. Initial fetch populates cache
    const { result, unmount } = renderHook(() =>
      useUserProfileDto(30, 'zh-TW')
    );
    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.userDto).toEqual(staleBackendDto);

    // 2. Advance past TTL (60,000 ms) so mounting a second consumer triggers background SWR revalidation
    vi.advanceTimersByTime(60001);

    let resolveBackgroundFetch!: (val: typeof mockUserDTO) => void;
    const backgroundFetchPromise = new Promise<typeof mockUserDTO>(
      (resolve) => {
        resolveBackgroundFetch = resolve;
      }
    );
    vi.mocked(fetchUserById).mockReturnValueOnce(backgroundFetchPromise);

    const { result: revalResult, unmount: unmountReval } = renderHook(() =>
      useUserProfileDto(30, 'zh-TW')
    );

    await vi.waitFor(() => {
      expect(fetchUserById).toHaveBeenCalledTimes(2);
    });

    // 3. Prime optimistic DTO while background revalidation is in flight (enters 10s transition window)
    act(() => {
      profileReadModel.prime({ userId: 30, language: 'zh-TW' }, primedDto);
    });

    // 4. Resolve the in-flight background revalidation with the non-converged staleBackendDto
    await act(async () => {
      resolveBackgroundFetch(staleBackendDto);
      await backgroundFetchPromise;
    });

    // Wait for the background fetch resolution to propagate through profileReadModel.resolveFetch:
    // because staleBackendDto has not converged with primedDto, userDto becomes primedDto (not staleBackendDto)
    await vi.waitFor(() => {
      expect(revalResult.current.userDto).toEqual(primedDto);
    });

    unmount();
    unmountReval();
  });

  it('accepts incoming backend DTO during background revalidation once hasDtoConverged is true, and protects deleted avatars (primed.avatar = null) from stale URLs (#785)', async () => {
    const primedClearedAvatar = {
      ...mockUserDTO,
      name: 'Avatar Cleared User',
      avatar: null,
    } as unknown as typeof mockUserDTO;
    const staleWithOldAvatar = {
      ...mockUserDTO,
      name: 'Avatar Cleared User',
      avatar: 'https://example.com/old-avatar.png',
    };

    expect(hasDtoConverged(primedClearedAvatar, staleWithOldAvatar)).toBe(
      false
    );
    expect(hasDtoConverged(primedClearedAvatar, primedClearedAvatar)).toBe(
      true
    );

    const primedWithAvatar = {
      ...mockUserDTO,
      name: 'Converged User',
      avatar: 'https://example.com/new.png',
    };
    const backendConvergedWithQuery = {
      ...mockUserDTO,
      name: 'Converged User',
      avatar: 'https://example.com/new.png?cb=123',
    };
    expect(hasDtoConverged(primedWithAvatar, backendConvergedWithQuery)).toBe(
      true
    );

    // Also verify manual force refetch bypasses optimistic convergence protection
    vi.mocked(fetchUserById).mockReset();
    vi.mocked(fetchUserById).mockResolvedValue(staleWithOldAvatar);
    profileReadModel.prime({ userId: 31, language: 'zh-TW' }, primedWithAvatar);

    const { result } = renderHook(() => useUserProfileDto(31, 'zh-TW'));
    act(() => {
      result.current.refetch?.();
    });

    await vi.waitFor(() => {
      expect(result.current.userDto).toEqual(staleWithOldAvatar);
    });
  });

  it('preserves 64-bit string user IDs above Number.MAX_SAFE_INTEGER across cache keys and refetch without float collision, and skips invalid IDs (#953)', async () => {
    vi.mocked(fetchUserById).mockReset();
    const dtoA = { ...mockUserDTO, name: 'Mentor 992' };
    const dtoB = { ...mockUserDTO, name: 'Mentor 993' };
    const dtoRefetched = { ...mockUserDTO, name: 'Mentor 999 Refetched' };

    vi.mocked(fetchUserById)
      .mockResolvedValueOnce(dtoA)
      .mockResolvedValueOnce(dtoB)
      .mockResolvedValueOnce(dtoRefetched);

    const { result: resA } = renderHook(() =>
      useUserProfileDto('9007199254740992', 'zh_TW')
    );
    const { result: resB } = renderHook(() =>
      useUserProfileDto('9007199254740993', 'zh_TW')
    );

    await vi.waitFor(() => {
      expect(resA.current.userDto).toEqual(dtoA);
      expect(resB.current.userDto).toEqual(dtoB);
    });

    expect(fetchUserById).toHaveBeenCalledWith(
      '9007199254740992',
      'zh_TW',
      expect.any(AbortSignal)
    );
    expect(fetchUserById).toHaveBeenCalledWith(
      '9007199254740993',
      'zh_TW',
      expect.any(AbortSignal)
    );

    const { result: resLarge } = renderHook(() =>
      useUserProfileDto('9999999999999999', 'zh_TW', dtoA)
    );
    act(() => {
      resLarge.current.refetch?.();
    });
    await vi.waitFor(() => {
      expect(resLarge.current.userDto).toEqual(dtoRefetched);
    });
    expect(fetchUserById).toHaveBeenLastCalledWith(
      '9999999999999999',
      'zh_TW',
      expect.any(AbortSignal)
    );

    vi.mocked(fetchUserById).mockClear();
    for (const invalid of ['0', '-1', 'abc']) {
      renderHook(() => useUserProfileDto(invalid, 'zh_TW'));
    }
    expect(fetchUserById).not.toHaveBeenCalled();
  });
  describe('expectedIsMentor monotonic guard (#981)', () => {
    const staleMentee = { ...mockUserDTO, user_id: 5, is_mentor: false };
    const freshMentor = { ...mockUserDTO, user_id: 5, is_mentor: true };

    it('discards a stale Mentee SSR seed and loads the fresh Mentor DTO instead of rendering or priming the seed', async () => {
      vi.mocked(fetchUserById).mockResolvedValue(freshMentor);

      const { result } = renderHook(() =>
        useUserProfileDto(5, 'zh_TW', staleMentee, { expectedIsMentor: true })
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.userDto).toBeNull();
      await vi.waitFor(() => {
        expect(result.current.userDto).toEqual(freshMentor);
      });
      expect(fetchUserById).toHaveBeenCalledTimes(1);
    });

    it('keeps the SSR seed untouched when no Mentor is expected (non-owner viewing a Mentee)', () => {
      const { result } = renderHook(() =>
        useUserProfileDto(5, 'zh_TW', staleMentee, { expectedIsMentor: false })
      );
      expect(result.current.isLoading).toBe(false);
      expect(result.current.userDto).toEqual(staleMentee);
      expect(fetchUserById).not.toHaveBeenCalled();
    });

    it('force-refetches a stale cached Mentee DTO exactly once even when the backend keeps lagging, across re-renders', async () => {
      vi.mocked(fetchUserById).mockResolvedValue({ ...staleMentee });
      profileReadModel.set({ userId: 5, language: 'zh_TW' }, staleMentee);

      const { result, rerender } = renderHook(() =>
        useUserProfileDto(5, 'zh_TW', undefined, { expectedIsMentor: true })
      );

      await vi.waitFor(() => {
        expect(fetchUserById).toHaveBeenCalledTimes(1);
      });
      await vi.waitFor(() => {
        expect(result.current.userDto).not.toBe(staleMentee);
      });
      rerender();
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(fetchUserById).toHaveBeenCalledTimes(1);
      expect(result.current.userDto?.is_mentor).toBe(false);
    });

    it('publishes the fresh Mentor DTO from the forced refetch', async () => {
      vi.mocked(fetchUserById).mockResolvedValue(freshMentor);
      profileReadModel.set({ userId: 5, language: 'zh_TW' }, staleMentee);

      const { result } = renderHook(() =>
        useUserProfileDto(5, 'zh_TW', undefined, { expectedIsMentor: true })
      );

      expect(result.current.userDto).toEqual(staleMentee);
      await vi.waitFor(() => {
        expect(result.current.userDto).toEqual(freshMentor);
      });
      expect(fetchUserById).toHaveBeenCalledTimes(1);
    });

    it('never refetches a cached Mentee DTO when no Mentor is expected', async () => {
      profileReadModel.set({ userId: 5, language: 'zh_TW' }, staleMentee);
      renderHook(() => useUserProfileDto(5, 'zh_TW'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(fetchUserById).not.toHaveBeenCalled();
    });
  });
});
