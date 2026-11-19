import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetUnwrapped = vi.fn();

vi.mock('@/lib/apiClient', () => ({
  BASE_URL: 'https://api.example.test',
  apiClient: {
    getUnwrapped: (...args: unknown[]) => mockGetUnwrapped(...args),
  },
}));

import {
  fetchUserByIdServer,
  getProfileCacheTag,
  REVALIDATE_SECONDS,
} from '@/services/profile/user.server';

describe('fetchUserByIdServer (#953 & #974)', () => {
  beforeEach(() => {
    mockGetUnwrapped.mockReset();
  });

  it('uses a 600-second ISR revalidation window and normalizes profile cache tags', () => {
    expect(REVALIDATE_SECONDS).toBe(600);
    expect(getProfileCacheTag('42')).toBe('profile-42');
    expect(getProfileCacheTag('  42  ')).toBe('profile-42');
    expect(getProfileCacheTag(42)).toBe('profile-42');
  });

  it('interpolates 64-bit string user IDs above Number.MAX_SAFE_INTEGER without rounding and attaches profile-{id} cache tag (#974)', async () => {
    mockGetUnwrapped.mockResolvedValueOnce({ user_id: 9007199254740993 });

    await fetchUserByIdServer('9999999999999999', 'zh_TW');

    expect(mockGetUnwrapped).toHaveBeenCalledWith(
      '/v1/mentors/9999999999999999/zh_TW/profile',
      {
        auth: false,
        next: {
          revalidate: 600,
          tags: ['profile-9999999999999999'],
        },
      }
    );
  });

  it('passes cache: "no-store" when bypassCache is true (#974 /profile/card)', async () => {
    mockGetUnwrapped.mockResolvedValueOnce({ user_id: 42 });

    await fetchUserByIdServer(42, 'zh_TW', { bypassCache: true });

    expect(mockGetUnwrapped).toHaveBeenCalledWith(
      '/v1/mentors/42/zh_TW/profile',
      {
        auth: false,
        cache: 'no-store',
      }
    );
  });

  it('returns null without calling API when given non-positive or malformed userId', async () => {
    expect(await fetchUserByIdServer('0', 'zh_TW')).toBeNull();
    expect(await fetchUserByIdServer('-5', 'zh_TW')).toBeNull();
    expect(await fetchUserByIdServer('abc', 'zh_TW')).toBeNull();
    expect(mockGetUnwrapped).not.toHaveBeenCalled();
  });
});
