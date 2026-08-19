import { apiClient, FetchApiError } from '@/lib/apiClient';
import { components } from '@/types/api';

/**
 * Fetches total unread count from the backend API.
 */
export async function fetchUnreadCount(userId: string | number) {
  return apiClient.getUnwrapped<
    components['schemas']['UnreadNotificationCountVO']
  >(`/api/v1/users/${userId}/notifications/unread-count`);
}

/**
 * Cursor-paginated notification listing from the backend API.
 */
export async function listNotifications(
  userId: string | number,
  cursor?: string | null,
  limit: number = 20
) {
  return apiClient.getUnwrapped<components['schemas']['NotificationListVO']>(
    `/api/v1/users/${userId}/notifications`,
    {
      params: {
        cursor: cursor || undefined,
        batch: limit,
      },
    }
  );
}

/**
 * Marks a single notification as read by updating its state.
 */
export async function markOneRead(
  userId: string | number,
  notificationId: string | number
) {
  const path = `/api/v1/users/${userId}/notifications/${notificationId}`;
  const res = await apiClient.put<{
    code: string;
    msg: string;
    data?: components['schemas']['NotificationVO'] | null;
  }>(path);

  if (res.code !== '0') {
    throw new FetchApiError(res.code, res.msg, path);
  }
  return res.data;
}

/**
 * Marks all notifications as read.
 */
export async function markAllRead(userId: string | number) {
  const path = `/api/v1/users/${userId}/notifications/read-all`;
  const res = await apiClient.put<{
    code: string;
    msg: string;
    data?: components['schemas']['MarkAllNotificationsReadVO'] | null;
  }>(path);

  if (res.code !== '0') {
    throw new FetchApiError(res.code, res.msg, path);
  }
  return res.data;
}
