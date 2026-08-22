import { components } from '@/types/api';

import type { NotificationItem } from './types';

// Below this, created_at is a seconds-precision Unix timestamp; at/above it,
// it's already in milliseconds (a seconds-precision timestamp only reaches
// this many digits in the year 2286).
const SECONDS_TIMESTAMP_MAX = 9999999999;

/**
 * Converts a backend NotificationVO (API DTO) into the frontend's
 * NotificationItem domain model. Kept as a standalone, dependency-free
 * module so both the real notificationService and its test-only mock
 * counterpart can share the exact same conversion logic.
 */
export function mapNotificationVOToItem(
  apiItem: components['schemas']['NotificationVO']
): NotificationItem {
  const isUnread = !apiItem.read_at;
  const metadata = (apiItem.metadata || {}) as {
    role?: 'mentor' | 'mentee';
    counterparty_name?: string;
  };
  const { role, counterparty_name } = metadata;

  // Map role and counterparty_name to menteeName/mentorName for frontend compatibility
  const menteeName = role === 'mentor' ? counterparty_name : undefined;
  const mentorName = role === 'mentee' ? counterparty_name : undefined;

  // Safe parsed createdAt - handle both seconds and milliseconds timestamps,
  // falling back to now if the backend omits or sends an invalid created_at
  // (otherwise `new Date(undefined).toISOString()` throws RangeError).
  const rawTime = Number(apiItem.created_at) || Date.now();
  const ms = rawTime < SECONDS_TIMESTAMP_MAX ? rawTime * 1000 : rawTime;
  const createdAt = new Date(ms).toISOString();

  return {
    id: String(apiItem.id),
    type: apiItem.type as NotificationItem['type'],
    createdAt,
    unread: isUnread,
    role,
    menteeName,
    mentorName,
  };
}
