import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetPassword } from '@/services/auth/resetPasswordByEmail';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/lib/apiClient';

describe('resetPasswordByEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('apiClient.get resolves with code "0" → returns { status: "success", code: 200 }', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      code: '0',
      msg: 'ok',
      data: { ttl_secs: 300 },
    });

    const result = await resetPassword('test@example.com');

    expect(result).toEqual({ status: 'success', code: 200 });
  });

  it('throws error → wraps in createGeneralErrorResponse(500, ...)', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('網路錯誤'));

    await expect(resetPassword('test@example.com')).rejects.toMatchObject({
      status: 'error',
      code: 500,
      message: '網路錯誤',
    });
  });
});
