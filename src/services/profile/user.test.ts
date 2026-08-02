import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient, ApiError, FetchApiError } from '@/lib/apiClient';
import { captureFlowFailure } from '@/lib/monitoring';

import { fetchUserById } from './user';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    getUnwrapped: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string
    ) {
      super(message);
    }
  },
  FetchApiError: class FetchApiError extends Error {
    constructor(
      public code: string,
      message: string
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

  it('does not retry and returns null on FetchApiError USER_NOT_FOUND', async () => {
    const fetchApiError = new FetchApiError(
      'USER_NOT_FOUND',
      'User Not Found',
      '/v1/mentors/1/zh_TW/profile'
    );
    vi.mocked(apiClient.getUnwrapped).mockRejectedValueOnce(fetchApiError);

    const result = await fetchUserById(1, 'zh_TW');

    expect(result).toBeNull();
    expect(apiClient.getUnwrapped).toHaveBeenCalledTimes(1); // No retry
  });
});
