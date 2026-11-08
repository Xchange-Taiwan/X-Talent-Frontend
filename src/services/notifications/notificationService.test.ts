import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/apiClient', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/apiClient')>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getUnwrapped: vi.fn(),
      putUnwrapped: vi.fn(),
    },
  };
});

import { apiClient, ApiError } from '@/lib/apiClient';

import {
  fetchUnreadCount,
  listNotifications,
  markAllRead,
  markOneRead,
} from './notificationService';

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchUnreadCount', () => {
    it('returns the data successfully', async () => {
      vi.mocked(apiClient.getUnwrapped).mockResolvedValue({ count: 5 });

      const result = await fetchUnreadCount('123');
      expect(result).toEqual({ count: 5 });
      expect(apiClient.getUnwrapped).toHaveBeenCalledWith(
        '/v1/users/123/notifications/unread-count'
      );
    });

    it('throws ApiError when API fails', async () => {
      vi.mocked(apiClient.getUnwrapped).mockRejectedValue(
        new ApiError(400, 'Failed count')
      );

      await expect(fetchUnreadCount('123')).rejects.toThrow(ApiError);
    });
  });

  describe('listNotifications', () => {
    it('returns list of notifications and next cursor successfully', async () => {
      vi.mocked(apiClient.getUnwrapped).mockResolvedValue({
        notifications: [
          {
            id: 1,
            title: 'Test',
            content: 'Hello',
            read: false,
            created_at: '2026-08-22T00:00:00Z',
          },
        ],
        next_cursor: 'abc',
      });

      const result = await listNotifications('123', null, 20);
      expect(result.next_cursor).toBe('abc');
      expect(result.notifications).toHaveLength(1);
    });

    it('handles empty response gracefully', async () => {
      vi.mocked(apiClient.getUnwrapped).mockResolvedValue(null);

      const result = await listNotifications('123', null, 20);
      expect(result).toEqual({ notifications: [], next_cursor: null });
    });

    it('throws ApiError when listing fails', async () => {
      vi.mocked(apiClient.getUnwrapped).mockRejectedValue(
        new ApiError(400, 'Failed list')
      );

      await expect(listNotifications('123')).rejects.toThrow(ApiError);
    });
  });

  describe('markOneRead', () => {
    it('calls API and returns data successfully', async () => {
      vi.mocked(apiClient.putUnwrapped).mockResolvedValue({
        id: 99,
        read: true,
      });

      const result = await markOneRead('123', '99');
      expect(result).toEqual({ id: 99, read: true });
      expect(apiClient.putUnwrapped).toHaveBeenCalledWith(
        '/v1/users/123/notifications/99'
      );
    });

    it('throws ApiError when marking fails', async () => {
      vi.mocked(apiClient.putUnwrapped).mockRejectedValue(
        new ApiError(400, 'Failed read')
      );

      await expect(markOneRead('123', '99')).rejects.toThrow(ApiError);
    });
  });

  describe('markAllRead', () => {
    it('calls API successfully', async () => {
      vi.mocked(apiClient.putUnwrapped).mockResolvedValue({ success: true });

      const result = await markAllRead('123');
      expect(result).toEqual({ success: true });
      expect(apiClient.putUnwrapped).toHaveBeenCalledWith(
        '/v1/users/123/notifications/read-all'
      );
    });

    it('throws ApiError when marking all fails', async () => {
      vi.mocked(apiClient.putUnwrapped).mockRejectedValue(
        new ApiError(400, 'Failed read all')
      );

      await expect(markAllRead('123')).rejects.toThrow(ApiError);
    });
  });
});
