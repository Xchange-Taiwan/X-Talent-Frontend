import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/apiClient';
import { resetPassword } from '@/services/auth/resetPassword';

vi.mock('@/lib/apiClient', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/apiClient')>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      putUnwrapped: vi.fn(),
    },
  };
});

import { apiClient } from '@/lib/apiClient';

describe('resetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('apiClient.putUnwrapped resolves successfully → returns successfully', async () => {
    vi.mocked(apiClient.putUnwrapped).mockResolvedValue(null);

    await expect(
      resetPassword('token123', 'NewPass1!', 'NewPass1!')
    ).resolves.toBeUndefined();
  });

  it('apiClient.putUnwrapped throws ApiError → propagates the error', async () => {
    const apiError = new ApiError(400, '無效的 token');
    vi.mocked(apiClient.putUnwrapped).mockRejectedValue(apiError);

    await expect(
      resetPassword('token123', 'NewPass1!', 'NewPass1!')
    ).rejects.toThrow(apiError);
  });
});
