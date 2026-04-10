import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetPassword } from '@/services/auth/resetPassword';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    put: vi.fn(),
  },
}));

import { apiClient } from '@/lib/apiClient';

describe('resetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('apiClient.put resolves with code "0" → returns { status: "success", code: 200 }', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({
      code: '0',
      msg: 'ok',
      data: null,
    });

    const result = await resetPassword('token123', 'NewPass1!', 'NewPass1!');

    expect(result).toEqual({ status: 'success', code: 200 });
  });

  it('throws existing AuthResponse error → re-throws original error unchanged', async () => {
    const authError = { status: 'error', code: 400, message: '無效的 token' };
    vi.mocked(apiClient.put).mockRejectedValue(authError);

    await expect(
      resetPassword('token123', 'NewPass1!', 'NewPass1!')
    ).rejects.toEqual(authError);
  });

  it('throws unknown error → wraps in createGeneralErrorResponse(500, ...)', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(new Error('網路錯誤'));

    await expect(
      resetPassword('token123', 'NewPass1!', 'NewPass1!')
    ).rejects.toMatchObject({
      status: 'error',
      code: 500,
      message: '網路錯誤',
    });
  });
});
