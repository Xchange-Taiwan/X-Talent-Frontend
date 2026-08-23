import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { apiClient, FetchApiError } from '@/lib/apiClient';

describe('resetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('apiClient.putUnwrapped resolves successfully → returns { status: "success", code: 200 }', async () => {
    vi.mocked(apiClient.putUnwrapped).mockResolvedValue(null);

    const result = await resetPassword('token123', 'NewPass1!', 'NewPass1!');

    expect(result).toEqual({ status: 'success', code: 200 });
  });

  it('throws FetchApiError → wraps in createGeneralErrorResponse(200, ...)', async () => {
    vi.mocked(apiClient.putUnwrapped).mockRejectedValue(
      new FetchApiError('ERR', '無效的 token', '')
    );

    await expect(
      resetPassword('token123', 'NewPass1!', 'NewPass1!')
    ).rejects.toMatchObject({
      status: 'error',
      code: 200,
      message: '無效的 token',
    });
  });

  it('throws existing AuthResponse error → re-throws original error unchanged', async () => {
    const authError = { status: 'error', code: 400, message: '無效的 token' };
    vi.mocked(apiClient.putUnwrapped).mockRejectedValue(authError);

    await expect(
      resetPassword('token123', 'NewPass1!', 'NewPass1!')
    ).rejects.toEqual(authError);
  });

  it('throws unknown error → wraps in createGeneralErrorResponse(500, ...)', async () => {
    vi.mocked(apiClient.putUnwrapped).mockRejectedValue(new Error('網路錯誤'));

    await expect(
      resetPassword('token123', 'NewPass1!', 'NewPass1!')
    ).rejects.toMatchObject({
      status: 'error',
      code: 500,
      message: '網路錯誤',
    });
  });
});
