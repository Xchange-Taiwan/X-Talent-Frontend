import { fromPartial } from '@total-typescript/shoehorn';
import { getSession } from 'next-auth/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/react', () => ({
  getSession: vi.fn(),
}));

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

import { apiClient, FetchApiError } from '@/lib/apiClient';

import { fetchPresignedUrl, fetchPresignedUrlByUserId } from './presignedUrl';

describe('presignedUrl service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchPresignedUrlByUserId', () => {
    it('returns data when successful', async () => {
      const mockData = {
        url: 'https://s3.amazonaws.com/bucket',
        fields: {
          key: 'avatar.png',
          AWSAccessKeyId: 'abc',
          'x-amz-security-token': 'token',
          policy: 'policy',
          signature: 'sig',
        },
      };

      vi.mocked(apiClient.getUnwrapped).mockResolvedValue(mockData);

      const result = await fetchPresignedUrlByUserId(42);
      expect(result).toEqual(mockData);
      expect(apiClient.getUnwrapped).toHaveBeenCalledWith(
        '/v1/storage/presigned-url/42'
      );
    });

    it('returns null and catches FetchApiError without unhandled rejection', async () => {
      vi.mocked(apiClient.getUnwrapped).mockRejectedValue(
        new FetchApiError(
          'ERR',
          'Failed presigned',
          '/v1/storage/presigned-url/42'
        )
      );

      const result = await fetchPresignedUrlByUserId(42);
      expect(result).toBeNull();
    });
  });

  describe('fetchPresignedUrl', () => {
    it('returns null if there is no session/user ID', async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const result = await fetchPresignedUrl();
      expect(result).toBeNull();
    });

    it('returns data if user ID is in the session and fetch succeeds', async () => {
      vi.mocked(getSession).mockResolvedValue(
        fromPartial({
          user: { id: '42' },
        })
      );

      const mockData = {
        url: 'https://s3.amazonaws.com/bucket',
        fields: {
          key: 'avatar.png',
          AWSAccessKeyId: 'abc',
          'x-amz-security-token': 'token',
          policy: 'policy',
          signature: 'sig',
        },
      };
      vi.mocked(apiClient.getUnwrapped).mockResolvedValue(mockData);

      const result = await fetchPresignedUrl();
      expect(result).toEqual(mockData);
    });
  });
});
