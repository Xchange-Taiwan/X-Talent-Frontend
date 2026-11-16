import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/apiClient';

import {
  type MentorProfileWritePayload,
  updateProfile,
  type UpdateProfileInput,
} from './updateProfile';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    put: vi.fn(),
  },
}));

describe('updateProfile service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws an error if userId is missing', async () => {
    const emptyInput = fromPartial<UpdateProfileInput>({});
    await expect(updateProfile(undefined, emptyInput)).rejects.toThrow(
      '未找到使用者 ID。請重新登入。'
    );
  });

  it('successfully updates profile with a canonical MentorProfileWritePayload and numeric userId', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ code: '0', msg: 'success' });

    const payload: MentorProfileWritePayload = {
      name: 'Jane Doe',
      avatar: 'https://s3.amazonaws.com/bucket/files/42/avatar?v=1754000000000',
      location: 'TWN',
      years_of_experience: '3_5',
      industry: 'tech',
      language: 'zh_TW',
      is_mentor: true,
      onboarding: true,
      about: 'Experienced frontend engineer',
      personal_statement: 'Welcome to book a session',
      job_title: 'Software Engineer',
      company: 'Acme',
      want_position: ['engineer'],
      want_skill: ['typescript'],
      want_topic: ['career'],
      have_skill: ['react_nextjs'],
      have_topic: ['frontend'],
    };

    await updateProfile('42', payload);

    expect(apiClient.put).toHaveBeenCalledWith('/v1/mentors/42/profile', {
      ...payload,
      user_id: 42,
    });
  });

  it('supports partial UpdateProfileInput during transitional compatibility', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ code: '0', msg: 'success' });

    const dummyProfileData = fromPartial<UpdateProfileInput>({
      job_title: 'Software Engineer',
    });

    await updateProfile('42', dummyProfileData);

    expect(apiClient.put).toHaveBeenCalledWith('/v1/mentors/42/profile', {
      job_title: 'Software Engineer',
      user_id: 42,
    });
  });

  it('throws an error if userId is an invalid non-numeric string', async () => {
    const emptyInput = fromPartial<UpdateProfileInput>({});
    await expect(updateProfile('abc', emptyInput)).rejects.toThrow(
      '使用者 ID 格式無效。'
    );
  });

  it('handles server network failure (Failed to fetch) correctly', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(
      new TypeError('Failed to fetch')
    );

    const emptyInput = fromPartial<UpdateProfileInput>({});
    await expect(updateProfile('42', emptyInput)).rejects.toThrow(
      '無法連接到伺服器。請檢查您的網絡連接。'
    );
  });

  it('bubbles up normal error messages', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(
      new Error('Internal Server Error')
    );

    const emptyInput = fromPartial<UpdateProfileInput>({});
    await expect(updateProfile('42', emptyInput)).rejects.toThrow(
      'Internal Server Error'
    );
  });
});
