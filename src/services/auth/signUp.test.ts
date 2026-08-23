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

import { apiClient, FetchApiError } from '@/lib/apiClient';

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

  it('apiClient.postUnwrapped resolves successfully → returns createSignUpSuccessResponse()', async () => {
    vi.mocked(apiClient.postUnwrapped).mockResolvedValue(null);

    const result = await signUp(validValues);

    expect(result).toEqual({ status: 'success', code: 0, httpStatus: 201 });
  });

  it('apiClient.postUnwrapped throws FetchApiError → throws createGeneralErrorResponse(200, message)', async () => {
    vi.mocked(apiClient.postUnwrapped).mockRejectedValue(
      new FetchApiError('ERR', '註冊失敗', '')
    );

    await expect(signUp(validValues)).rejects.toMatchObject({
      status: 'error',
      code: 200,
      message: '註冊失敗',
    });
  });

  it('apiClient.postUnwrapped throws ApiError with status 422 → throws createValidationErrorResponse()', async () => {
    vi.mocked(apiClient.postUnwrapped).mockRejectedValue(
      new ApiError(422, 'Unprocessable Entity')
    );

    await expect(signUp(validValues)).rejects.toMatchObject({
      status: 'error',
      code: 422,
    });
  });

  it('apiClient.postUnwrapped throws ApiError with status 406 → throws createEmailAlreadyRegisteredResponse()', async () => {
    vi.mocked(apiClient.postUnwrapped).mockRejectedValue(
      new ApiError(406, 'Not Acceptable')
    );

    await expect(signUp(validValues)).rejects.toMatchObject({
      status: 'error',
      code: 406,
    });
  });

  it('apiClient.postUnwrapped throws ApiError with status 429 → throws createRateLimitResponse()', async () => {
    vi.mocked(apiClient.postUnwrapped).mockRejectedValue(
      new ApiError(429, 'Too Many Requests')
    );

    await expect(signUp(validValues)).rejects.toMatchObject({
      status: 'error',
      code: 429,
    });
  });

  it('apiClient.postUnwrapped throws ApiError with other status → throws createGeneralErrorResponse(status, message)', async () => {
    vi.mocked(apiClient.postUnwrapped).mockRejectedValue(
      new ApiError(500, 'Internal Server Error')
    );

    await expect(signUp(validValues)).rejects.toMatchObject({
      status: 'error',
      code: 500,
      message: 'Internal Server Error',
    });
  });
});
