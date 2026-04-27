import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/profile/user', () => ({
  fetchUserById: vi.fn(),
}));

vi.mock('@/hooks/user/interests/useInterests', () => ({
  getInterestsCached: vi.fn(),
}));

import { getInterestsCached } from '@/hooks/user/interests/useInterests';
import { fetchUserById, type MentorProfileVO } from '@/services/profile/user';

import useUserData, {
  clearUserDataCache,
  USER_DATA_CACHE_TTL_MS as TTL_MS,
} from './useUserData';

const mockFetchUserById = vi.mocked(fetchUserById);
const mockGetInterestsCached = vi.mocked(getInterestsCached);

const makeUserDto = (id: number): MentorProfileVO =>
  ({
    user_id: id,
    name: `User ${id}`,
    avatar: '',
    is_mentor: false,
    experiences: [],
  }) as unknown as MentorProfileVO;

const emptyInterests = {
  interestedPositions: [],
  skills: [],
  topics: [],
  expertises: [],
  whatIOffers: [],
};

describe('useUserData caching', () => {
  beforeEach(() => {
    mockFetchUserById.mockReset();
    mockGetInterestsCached.mockReset();
    mockGetInterestsCached.mockResolvedValue(emptyInterests);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('re-mount within TTL window reuses cache (no second fetch)', async () => {
    const userId = 4001;
    mockFetchUserById.mockResolvedValue(makeUserDto(userId));

    const first = renderHook(() => useUserData(userId, 'en'));
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(mockFetchUserById).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = renderHook(() => useUserData(userId, 'en'));
    await waitFor(() => expect(second.result.current.userData).not.toBeNull());
    expect(mockFetchUserById).toHaveBeenCalledTimes(1);
    second.unmount();
  });

  it('re-mount after TTL: shows stale data immediately and revalidates in background', async () => {
    const userId = 4002;
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(10_000);

    const stale = { ...makeUserDto(userId), name: 'Stale 4002' };
    const fresh = { ...makeUserDto(userId), name: 'Fresh 4002' };
    mockFetchUserById.mockResolvedValueOnce(stale as MentorProfileVO);

    const first = renderHook(() => useUserData(userId, 'en'));
    await waitFor(() =>
      expect(first.result.current.userData?.name).toBe('Stale 4002')
    );
    first.unmount();

    nowSpy.mockReturnValue(10_000 + TTL_MS + 1);
    let resolveFresh: (value: MentorProfileVO) => void = () => {};
    mockFetchUserById.mockImplementationOnce(
      () =>
        new Promise<MentorProfileVO>((resolve) => {
          resolveFresh = resolve;
        })
    );

    const second = renderHook(() => useUserData(userId, 'en'));
    // Stale data is shown immediately without entering loading state,
    // before the background refetch resolves.
    await waitFor(() =>
      expect(second.result.current.userData?.name).toBe('Stale 4002')
    );
    expect(second.result.current.isLoading).toBe(false);
    expect(mockFetchUserById).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveFresh(fresh as MentorProfileVO);
    });
    await waitFor(() =>
      expect(second.result.current.userData?.name).toBe('Fresh 4002')
    );
    second.unmount();
  });

  it('background revalidation failure keeps stale data without flipping to error', async () => {
    const userId = 4006;
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(20_000);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mockFetchUserById.mockResolvedValueOnce({
      ...makeUserDto(userId),
      name: 'Stale 4006',
    } as MentorProfileVO);

    const first = renderHook(() => useUserData(userId, 'en'));
    await waitFor(() =>
      expect(first.result.current.userData?.name).toBe('Stale 4006')
    );
    first.unmount();

    nowSpy.mockReturnValue(20_000 + TTL_MS + 1);
    mockFetchUserById.mockRejectedValueOnce(new Error('Network down'));

    const second = renderHook(() => useUserData(userId, 'en'));
    await waitFor(() =>
      expect(second.result.current.userData?.name).toBe('Stale 4006')
    );
    // Wait for the rejected promise to settle, then assert state is intact.
    await waitFor(() => expect(mockFetchUserById).toHaveBeenCalledTimes(2));
    expect(second.result.current.userData?.name).toBe('Stale 4006');
    expect(second.result.current.error).toBeNull();

    consoleErrorSpy.mockRestore();
    second.unmount();
  });

  it('background revalidation returning null keeps stale data', async () => {
    const userId = 4007;
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(30_000);

    mockFetchUserById.mockResolvedValueOnce({
      ...makeUserDto(userId),
      name: 'Stale 4007',
    } as MentorProfileVO);

    const first = renderHook(() => useUserData(userId, 'en'));
    await waitFor(() =>
      expect(first.result.current.userData?.name).toBe('Stale 4007')
    );
    first.unmount();

    nowSpy.mockReturnValue(30_000 + TTL_MS + 1);
    mockFetchUserById.mockResolvedValueOnce(null);

    const second = renderHook(() => useUserData(userId, 'en'));
    await waitFor(() => expect(mockFetchUserById).toHaveBeenCalledTimes(2));
    expect(second.result.current.userData?.name).toBe('Stale 4007');
    expect(second.result.current.error).toBeNull();
    second.unmount();
  });

  it('clearUserDataCache forces a refetch on next mount', async () => {
    const userId = 4003;
    mockFetchUserById.mockResolvedValue(makeUserDto(userId));

    const first = renderHook(() => useUserData(userId, 'en'));
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    clearUserDataCache(userId, 'en');

    const second = renderHook(() => useUserData(userId, 'en'));
    await waitFor(() => expect(second.result.current.isLoading).toBe(false));
    expect(mockFetchUserById).toHaveBeenCalledTimes(2);
    second.unmount();
  });

  it('failed fetch (null result) is not cached → next mount refetches', async () => {
    const userId = 4004;
    mockFetchUserById.mockResolvedValueOnce(null);

    const first = renderHook(() => useUserData(userId, 'en'));
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(first.result.current.error).toBe('User not found');
    first.unmount();

    mockFetchUserById.mockResolvedValueOnce(makeUserDto(userId));

    const second = renderHook(() => useUserData(userId, 'en'));
    await waitFor(() => expect(second.result.current.isLoading).toBe(false));
    expect(mockFetchUserById).toHaveBeenCalledTimes(2);
    expect(second.result.current.userData).not.toBeNull();
    second.unmount();
  });

  it('concurrent mounts of same user dedupe to one network call', async () => {
    const userId = 4005;
    let resolveFetch: (value: MentorProfileVO) => void = () => {};
    mockFetchUserById.mockImplementation(
      () =>
        new Promise<MentorProfileVO>((resolve) => {
          resolveFetch = resolve;
        })
    );

    const a = renderHook(() => useUserData(userId, 'en'));
    const b = renderHook(() => useUserData(userId, 'en'));

    expect(mockFetchUserById).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch(makeUserDto(userId));
    });

    await waitFor(() => expect(a.result.current.userData).not.toBeNull());
    await waitFor(() => expect(b.result.current.userData).not.toBeNull());
    expect(mockFetchUserById).toHaveBeenCalledTimes(1);

    a.unmount();
    b.unmount();
  });
});
