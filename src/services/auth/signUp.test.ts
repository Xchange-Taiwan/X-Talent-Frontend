import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/apiClient';
import { signUp } from '@/services/auth/signUp';

vi.mock('@/lib/apiClient', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/apiClient')>();
  return {
    ...actual,
    apiClient: {
      postUnwrapped: vi.fn(),
    },
  };
});

import { apiClient } from '@/lib/apiClient';

const validValues = {
  email: 'test@example.com',
  password: 'Password1!',
  confirm_password: 'Password1!',
  hasReadTermsOfService: true,
};

describe('signUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('apiClient.postUnwrapped resolves successfully → returns successfully', async () => {
    vi.mocked(apiClient.postUnwrapped).mockResolvedValue(null);

    await expect(signUp(validValues)).resolves.toBeUndefined();
  });

  it('apiClient.postUnwrapped throws ApiError → propagates the error', async () => {
    const apiError = new ApiError(400, 'Bad Request');
    vi.mocked(apiClient.postUnwrapped).mockRejectedValue(apiError);

    await expect(signUp(validValues)).rejects.toThrow(apiError);
  });
});
