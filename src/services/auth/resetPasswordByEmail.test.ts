import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/apiClient';
import { resetPassword } from '@/services/auth/resetPasswordByEmail';

vi.mock('@/lib/apiClient', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/apiClient')>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getUnwrapped: vi.fn(),
    },
  };
});

import { apiClient } from '@/lib/apiClient';

describe('resetPasswordByEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('apiClient.getUnwrapped resolves successfully → returns successfully', async () => {
    vi.mocked(apiClient.getUnwrapped).mockResolvedValue({ ttl_secs: 300 });

    await expect(resetPassword('test@example.com')).resolves.toBeUndefined();
  });

  it('apiClient.getUnwrapped throws ApiError → propagates the error', async () => {
    const apiError = new ApiError(400, '信件寄送失敗');
    vi.mocked(apiClient.getUnwrapped).mockRejectedValue(apiError);

    await expect(resetPassword('test@example.com')).rejects.toThrow(apiError);
  });
});
