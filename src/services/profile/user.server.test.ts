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
  REVALIDATE_SECONDS,
} from '@/services/profile/user.server';

describe('fetchUserByIdServer (#953)', () => {
  beforeEach(() => {
    mockGetUnwrapped.mockReset();
  });

  it('uses a 600-second ISR revalidation window', () => {
    expect(REVALIDATE_SECONDS).toBe(600);
  });

  it('interpolates 64-bit string user IDs above Number.MAX_SAFE_INTEGER without rounding', async () => {
    mockGetUnwrapped.mockResolvedValueOnce({ user_id: 9007199254740993 });

    await fetchUserByIdServer('9999999999999999', 'zh_TW');

    expect(mockGetUnwrapped).toHaveBeenCalledWith(
      '/v1/mentors/9999999999999999/zh_TW/profile',
      {
        auth: false,
        next: { revalidate: 600 },
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
