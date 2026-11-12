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
    actor_role?: 'mentor' | 'mentee' | 'system';
    counterparty_name?: string;
    reservation_id?: number | string | null;
    dtstart?: number;
    dtend?: number;
  };
  const {
    role,
    actor_role,
    counterparty_name,
    reservation_id,
    dtstart,
    dtend,
  } = metadata;

  // Map role and counterparty_name to menteeName/mentorName for frontend compatibility
  const menteeName = role === 'mentor' ? counterparty_name : undefined;
  const mentorName = role === 'mentee' ? counterparty_name : undefined;
  const normalizedReservationId =
    (typeof reservation_id === 'number' && Number.isFinite(reservation_id)) ||
    (typeof reservation_id === 'string' && reservation_id.trim().length > 0)
      ? String(reservation_id).trim()
      : undefined;
  const normalizedDtstart =
    typeof dtstart === 'number' && Number.isFinite(dtstart)
      ? dtstart
      : undefined;
  const normalizedDtend =
    typeof dtend === 'number' && Number.isFinite(dtend) ? dtend : undefined;

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
    actorRole: actor_role,
    menteeName,
    mentorName,
    ...(normalizedReservationId !== undefined
      ? { reservationId: normalizedReservationId }
      : {}),
    ...(normalizedDtstart !== undefined ? { dtstart: normalizedDtstart } : {}),
    ...(normalizedDtend !== undefined ? { dtend: normalizedDtend } : {}),
  };
}
