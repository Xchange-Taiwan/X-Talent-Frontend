import { act, renderHook, waitFor } from '@testing-library/react';
import { fromAny, fromPartial } from '@total-typescript/shoehorn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/profile/user', () => ({
  fetchUserById: vi.fn(),
}));

import { EMPTY_TAG_CATALOGS } from '@/services/profile/tagCatalog';
import { fetchUserById } from '@/services/profile/user';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

import useUserData, {
  clearUserDataCache,
  primeUserDataCache,
  USER_DATA_CACHE_TTL_MS as TTL_MS,
} from './useUserData';

const mockFetchUserById = vi.mocked(fetchUserById);

const makeUserDto = (id: number): MentorProfileVO =>
  ({
    user_id: id,
    name: `User ${id}`,
    avatar: '',
    is_mentor: false,
    experiences: [],
    want_position: [],
    want_skill: [],
    want_topic: [],
    have_skill: [],
    have_topic: [],
  }) as unknown as MentorProfileVO;

describe('useUserData caching', () => {
  beforeEach(() => {
    mockFetchUserById.mockReset();
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

  it('primeUserDataCache: next mount renders from cache without an API call', async () => {
    const userId = 4101;
    const primed = {
      ...makeUserDto(userId),
      name: 'Primed 4101',
    } as MentorProfileVO;

    primeUserDataCache(userId, 'en', primed);

    const { result, unmount } = renderHook(() => useUserData(userId, 'en'));

    await waitFor(() =>
      expect(result.current.userData?.name).toBe('Primed 4101')
    );
    expect(mockFetchUserById).not.toHaveBeenCalled();
    unmount();
  });

  it('primeUserDataCache: replaces a stale entry so next mount sees primed data', async () => {
    const userId = 4102;
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(50_000);

    mockFetchUserById.mockResolvedValueOnce({
      ...makeUserDto(userId),
      name: 'Stale 4102',
    } as MentorProfileVO);

    const first = renderHook(() => useUserData(userId, 'en'));
    await waitFor(() =>
      expect(first.result.current.userData?.name).toBe('Stale 4102')
    );
    first.unmount();

    nowSpy.mockReturnValue(50_000 + TTL_MS + 1);
    primeUserDataCache(userId, 'en', {
      ...makeUserDto(userId),
      name: 'Primed 4102',
    } as MentorProfileVO);

    const second = renderHook(() => useUserData(userId, 'en'));
    await waitFor(() =>
      expect(second.result.current.userData?.name).toBe('Primed 4102')
    );
    // Only the original fetch was called — prime kept the second mount off
    // the network.
    expect(mockFetchUserById).toHaveBeenCalledTimes(1);
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
    expect(first.result.current.error).toBe('USER_NOT_FOUND');
    first.unmount();

    mockFetchUserById.mockResolvedValueOnce(makeUserDto(userId));

    const second = renderHook(() => useUserData(userId, 'en'));
    await waitFor(() => expect(second.result.current.isLoading).toBe(false));
    expect(mockFetchUserById).toHaveBeenCalledTimes(2);
    expect(second.result.current.userData).not.toBeNull();
    second.unmount();
  });

  it('forwards initialDto through to useUserProfileDto, rendering populated data immediately with no fetch', () => {
    const userId = 4200;
    const ssrDto = makeUserDto(userId);

    const { result, unmount } = renderHook(() =>
      useUserData(userId, 'en', ssrDto)
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.userData).not.toBeNull();
    expect(result.current.userData?.user_id).toBe(userId);
    expect(mockFetchUserById).not.toHaveBeenCalled();
    unmount();
  });

  it('treats initialDto = null (SSR fetch failure) as missing and runs the client-side fallback fetch', async () => {
    const userId = 4201;
    mockFetchUserById.mockResolvedValueOnce(makeUserDto(userId));

    const { result, unmount } = renderHook(() =>
      useUserData(userId, 'en', null)
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetchUserById).toHaveBeenCalledTimes(1);
    expect(result.current.userData?.user_id).toBe(userId);
    unmount();
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

  it('maps about and personal_statement from MentorProfileVO into userData (#857)', () => {
    const userId = 4300;
    const ssrDto: MentorProfileVO = {
      ...makeUserDto(userId),
      about: '第一段介紹\n第二段介紹',
      personal_statement: '給導生的第一點\n給導生的第二點',
    };

    const { result, unmount } = renderHook(() =>
      useUserData(userId, 'en', ssrDto)
    );

    expect(result.current.userData?.about).toBe('第一段介紹\n第二段介紹');
    expect(result.current.userData?.personal_statement).toBe(
      '給導生的第一點\n給導生的第二點'
    );
    unmount();
  });

  it('maps mentor stats (#760), localized location, and industries into userData (#736)', () => {
    const userId = 4301;
    const ssrDto = fromPartial<MentorProfileVO>({
      ...makeUserDto(userId),
      is_mentor: true,
      location: 'TWN',
      years_of_experience: 'FIVE_TO_TEN',
      industry: fromAny({
        id: 1,
        subject_group: null,
        subject: '軟體及網路相關業',
      }),
      stats: {
        completed_meeting_count: 128,
        rating_count: 12,
        rating_average: 8.5,
      },
    });

    const { result, unmount } = renderHook(() =>
      useUserData(userId, 'zh_TW', ssrDto)
    );

    expect(result.current.userData?.location).toBe('台灣');
    expect(result.current.userData?.years_of_experience).toBe('5~10 年');
    expect(result.current.userData?.industries).toEqual([
      {
        subject_group: '軟體及網路相關業',
        subject: '軟體及網路相關業',
      },
    ]);
    expect(result.current.userData?.stats).toEqual({
      completed_meeting_count: 128,
      rating_count: 12,
      rating_average: 8.5,
    });
    unmount();
  });

  it('falls back to is_primary workExperience job_location (or first entry) when userDto.location is empty (#736)', () => {
    const primaryUserId = 4302;
    const primaryWorkDto = fromPartial<MentorProfileVO>({
      ...makeUserDto(primaryUserId),
      is_mentor: true,
      location: '',
      experiences: fromAny([
        {
          category: 'WORK',
          order: 1,
          mentor_experiences_metadata: {
            data: [
              {
                job: 'Frontend Engineer',
                company: 'Co A',
                job_period_start: '2020',
                job_period_end: '2022',
                industry: 'SOFTWARE',
                job_location: 'USA',
                description: '',
                is_primary: false,
              },
              {
                job: 'Staff Designer',
                company: 'Co B',
                job_period_start: '2022',
                job_period_end: '至今',
                industry: 'DESIGN',
                job_location: 'JPN',
                description: '',
                is_primary: true,
              },
            ],
          },
        },
      ]),
    });

    const primaryHook = renderHook(() =>
      useUserData(primaryUserId, 'zh_TW', primaryWorkDto)
    );
    expect(primaryHook.result.current.userData?.location).toBe('日本');
    primaryHook.unmount();

    const fallbackFirstUserId = 4303;
    const fallbackFirstDto = fromPartial<MentorProfileVO>({
      ...makeUserDto(fallbackFirstUserId),
      is_mentor: true,
      location: '',
      experiences: fromAny([
        {
          category: 'WORK',
          order: 1,
          mentor_experiences_metadata: {
            data: [
              {
                job: 'Product Manager',
                company: 'Co C',
                job_period_start: '2021',
                job_period_end: '2024',
                industry: 'SOFTWARE',
                job_location: 'SGP',
                description: '',
                is_primary: false,
              },
              {
                job: 'Engineer',
                company: 'Co D',
                job_period_start: '2019',
                job_period_end: '2021',
                industry: 'SOFTWARE',
                job_location: 'USA',
                description: '',
                is_primary: false,
              },
            ],
          },
        },
      ]),
    });

    const fallbackFirstHook = renderHook(() =>
      useUserData(fallbackFirstUserId, 'zh_TW', fallbackFirstDto)
    );
    expect(fallbackFirstHook.result.current.userData?.location).toBe('新加坡');
    fallbackFirstHook.unmount();
  });

  it('translates workExperiences industry codes via tagCatalog and deduplicates against primary industry (#736)', () => {
    const userId = 4304;
    const initialCatalogs: TagCatalogsByBucket = {
      ...EMPTY_TAG_CATALOGS,
      industry: [
        { subject_group: 'SOFTWARE', subject: '軟體及網路相關業' },
        { subject_group: 'DESIGN', subject: '設計及創意相關業' },
      ],
    };

    const ssrDto = fromPartial<MentorProfileVO>({
      ...makeUserDto(userId),
      is_mentor: true,
      industry: fromAny({
        id: 1,
        subject_group: 'SOFTWARE',
        subject: '軟體及網路相關業',
      }),
      experiences: fromAny([
        {
          category: 'WORK',
          order: 1,
          mentor_experiences_metadata: {
            data: [
              {
                job: 'Lead Designer',
                company: 'Studio A',
                job_period_start: '2023',
                job_period_end: '至今',
                industry: 'SOFTWARE',
                job_location: 'TWN',
                description: '',
                is_primary: true,
              },
              {
                job: 'Senior UX Designer',
                company: 'Studio B',
                job_period_start: '2021',
                job_period_end: '2023',
                industry: 'DESIGN',
                job_location: 'TWN',
                description: '',
                is_primary: false,
              },
              {
                job: 'Product Designer',
                company: 'Studio C',
                job_period_start: '2019',
                job_period_end: '2021',
                industry: 'DESIGN',
                job_location: 'TWN',
                description: '',
                is_primary: false,
              },
              {
                job: 'Visual Designer',
                company: 'Studio D',
                job_period_start: '2018',
                job_period_end: '2019',
                industry: '軟體及網路相關業',
                job_location: 'TWN',
                description: '',
                is_primary: false,
              },
              {
                job: 'Consultant',
                company: 'Lab E',
                job_period_start: '2017',
                job_period_end: '2018',
                industry: 'LEGACY_CUSTOM_IND',
                job_location: 'TWN',
                description: '',
                is_primary: false,
              },
            ],
          },
        },
      ]),
    });

    const { result, unmount } = renderHook(() =>
      useUserData(userId, 'zh_TW', ssrDto, initialCatalogs)
    );

    expect(result.current.userData?.industries).toEqual([
      { subject_group: 'SOFTWARE', subject: '軟體及網路相關業' },
      { subject_group: 'DESIGN', subject: '設計及創意相關業' },
      {
        subject_group: 'LEGACY_CUSTOM_IND',
        subject: 'LEGACY_CUSTOM_IND',
      },
    ]);
    unmount();
  });
});
