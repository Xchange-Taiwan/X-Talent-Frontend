import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient, ApiError } from '@/lib/apiClient';
import { captureFlowFailure } from '@/lib/monitoring';

import { fetchUserById } from './user';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    getUnwrapped: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
      public body?: unknown
    ) {
      super(message);
    }
  },
}));

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn().mockResolvedValue(undefined),
}));

describe('fetchUserById service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully fetches user on first attempt', async () => {
    const mockUser = { user_id: 1, name: 'Alice' };
    vi.mocked(apiClient.getUnwrapped).mockResolvedValueOnce(mockUser);

    const result = await fetchUserById(1, 'zh_TW');

    expect(result).toEqual(mockUser);
    expect(apiClient.getUnwrapped).toHaveBeenCalledTimes(1);
  });

  it('automatically retries once on network failure and succeeds', async () => {
    const mockUser = { user_id: 1, name: 'Alice' };
    vi.mocked(apiClient.getUnwrapped)
      .mockRejectedValueOnce(new Error('Network connection failed'))
      .mockResolvedValueOnce(mockUser);

    const result = await fetchUserById(1, 'zh_TW');

    expect(result).toEqual(mockUser);
    expect(apiClient.getUnwrapped).toHaveBeenCalledTimes(2);
  });

  it('stops retrying and throws error after max retries exceed', async () => {
    vi.mocked(apiClient.getUnwrapped).mockRejectedValue(
      new Error('Network connection failed')
    );

    await expect(fetchUserById(1, 'zh_TW')).rejects.toThrow(
      'Network connection failed'
    );
    expect(apiClient.getUnwrapped).toHaveBeenCalledTimes(2); // 1 initial + 1 retry

    expect(captureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'profile',
        step: 'fetch_user_profile',
        message: 'Network connection failed',
        errorCode: 'network_error',
      })
    );
  });

  it('does not retry and returns null on 404 client error', async () => {
    const apiError = new ApiError(404, 'Not Found');
    vi.mocked(apiClient.getUnwrapped).mockRejectedValueOnce(apiError);

    const result = await fetchUserById(1, 'zh_TW');

    expect(result).toBeNull();
    expect(apiClient.getUnwrapped).toHaveBeenCalledTimes(1); // No retry for 404
  });

  it('does not retry and returns null on ApiError with USER_NOT_FOUND body code', async () => {
    const apiError = new ApiError(400, 'User Not Found', {
      code: 'USER_NOT_FOUND',
    });
    vi.mocked(apiClient.getUnwrapped).mockRejectedValueOnce(apiError);

    const result = await fetchUserById(1, 'zh_TW');

    expect(result).toBeNull();
    expect(apiClient.getUnwrapped).toHaveBeenCalledTimes(1); // No retry
  });

  it('automatically retries once on 5xx server error and succeeds', async () => {
    const mockUser = { user_id: 1, name: 'Alice' };
    const serverError = new ApiError(500, 'Internal Server Error');
    vi.mocked(apiClient.getUnwrapped)
      .mockRejectedValueOnce(serverError)
      .mockResolvedValueOnce(mockUser);

    const result = await fetchUserById(1, 'zh_TW');

    expect(result).toEqual(mockUser);
    expect(apiClient.getUnwrapped).toHaveBeenCalledTimes(2); // Should retry
  });

  it('does not retry and throws immediately on 400/401 client errors', async () => {
    const badRequestError = new ApiError(400, 'Bad Request');
    vi.mocked(apiClient.getUnwrapped).mockRejectedValueOnce(badRequestError);

    await expect(fetchUserById(1, 'zh_TW')).rejects.toThrow('Bad Request');
    expect(apiClient.getUnwrapped).toHaveBeenCalledTimes(1); // No retry
  });

  it('skips Sentry captureFlowFailure logging when silent is true', async () => {
    vi.mocked(apiClient.getUnwrapped).mockRejectedValue(
      new Error('Silent connection error')
    );

    // Call with silent = true (4th argument)
    await expect(fetchUserById(1, 'zh_TW', undefined, true)).rejects.toThrow(
      'Silent connection error'
    );
    expect(apiClient.getUnwrapped).toHaveBeenCalledTimes(2);

    // captureFlowFailure should NOT have been called!
    expect(captureFlowFailure).not.toHaveBeenCalled();
  });

  it('does not retry and throws immediately when request is aborted (AbortError)', async () => {
    const abortError = new DOMException(
      'The user aborted a request.',
      'AbortError'
    );
    vi.mocked(apiClient.getUnwrapped).mockRejectedValueOnce(abortError);

    await expect(fetchUserById(1, 'zh_TW')).rejects.toThrow(
      'The user aborted a request.'
    );
    expect(apiClient.getUnwrapped).toHaveBeenCalledTimes(1); // Should not retry

    // captureFlowFailure should NOT have been called!
    expect(captureFlowFailure).not.toHaveBeenCalled();
  });
});
