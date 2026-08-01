import { fromPartial } from '@total-typescript/shoehorn';
import { getSession } from 'next-auth/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/apiClient';

import type { UpdateProfileInput } from './updateProfile';
import { updateProfile } from './updateProfile';

vi.mock('next-auth/react', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    put: vi.fn(),
  },
}));

describe('updateProfile service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws an error if userId is missing in the session', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const emptyInput = fromPartial<UpdateProfileInput>({});
    await expect(updateProfile(emptyInput)).rejects.toThrow(
      '未找到使用者 ID。請重新登入。'
    );
  });

  it('successfully updates profile with a valid numeric userId', async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: '42' },
      expires: '',
    });
    vi.mocked(apiClient.put).mockResolvedValue({ code: '0', msg: 'success' });

    const dummyProfileData = fromPartial<UpdateProfileInput>({
      job_title: 'Software Engineer',
    });

    await updateProfile(dummyProfileData);

    expect(apiClient.put).toHaveBeenCalledWith('/v1/mentors/42/profile', {
      job_title: 'Software Engineer',
      user_id: 42,
    });
  });

  it('throws an error if userId is an invalid non-numeric string', async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: 'abc' },
      expires: '',
    });

    const emptyInput = fromPartial<UpdateProfileInput>({});
    await expect(updateProfile(emptyInput)).rejects.toThrow(
      '使用者 ID 格式無效。'
    );
  });

  it('handles server network failure (Failed to fetch) correctly', async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: '42' },
      expires: '',
    });
    vi.mocked(apiClient.put).mockRejectedValue(
      new TypeError('Failed to fetch')
    );

    const emptyInput = fromPartial<UpdateProfileInput>({});
    await expect(updateProfile(emptyInput)).rejects.toThrow(
      '無法連接到伺服器。請檢查您的網絡連接。'
    );
  });

  it('bubbles up normal error messages', async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: '42' },
      expires: '',
    });
    vi.mocked(apiClient.put).mockRejectedValue(
      new Error('Internal Server Error')
    );

    const emptyInput = fromPartial<UpdateProfileInput>({});
    await expect(updateProfile(emptyInput)).rejects.toThrow(
      'Internal Server Error'
    );
  });
});
