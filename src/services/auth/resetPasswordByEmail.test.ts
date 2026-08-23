import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetPassword } from '@/services/auth/resetPasswordByEmail';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    getUnwrapped: vi.fn(),
  },
  FetchApiError: class FetchApiError extends Error {
    constructor(
      public readonly code: string,
      public readonly msg: string,
      public readonly path: string
    ) {
      super(msg);
    }
  },
}));

import { apiClient, FetchApiError } from '@/lib/apiClient';

describe('resetPasswordByEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('apiClient.getUnwrapped resolves successfully → returns { status: "success", code: 200 }', async () => {
    vi.mocked(apiClient.getUnwrapped).mockResolvedValue({ ttl_secs: 300 });

    const result = await resetPassword('test@example.com');

    expect(result).toEqual({ status: 'success', code: 200 });
  });

  it('throws FetchApiError → wraps in createGeneralErrorResponse(200, ...)', async () => {
    vi.mocked(apiClient.getUnwrapped).mockRejectedValue(
      new FetchApiError('ERR', '信件寄送失敗', '')
    );

    await expect(resetPassword('test@example.com')).rejects.toMatchObject({
      status: 'error',
      code: 200,
      message: '信件寄送失敗',
    });
  });

  it('throws error → wraps in createGeneralErrorResponse(500, ...)', async () => {
    vi.mocked(apiClient.getUnwrapped).mockRejectedValue(new Error('網路錯誤'));

    await expect(resetPassword('test@example.com')).rejects.toMatchObject({
      status: 'error',
      code: 500,
      message: '網路錯誤',
    });
  });
});
