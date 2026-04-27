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

import useUserData, { clearUserDataCache } from './useUserData';

const mockFetchUserById = vi.mocked(fetchUserById);
const mockGetInterestsCached = vi.mocked(getInterestsCached);

const TTL_MS = 5_000;

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

  it('re-mount after TTL expires triggers a fresh fetch', async () => {
    const userId = 4002;
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(10_000);
    mockFetchUserById.mockResolvedValue(makeUserDto(userId));

    const first = renderHook(() => useUserData(userId, 'en'));
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    nowSpy.mockReturnValue(10_000 + TTL_MS + 1);

    const second = renderHook(() => useUserData(userId, 'en'));
    await waitFor(() => expect(second.result.current.isLoading).toBe(false));
    expect(mockFetchUserById).toHaveBeenCalledTimes(2);
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
