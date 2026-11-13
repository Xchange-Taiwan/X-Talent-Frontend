import { components } from '@/types/api';

import type { NotificationItem } from './types';

// Below this, created_at is a seconds-precision Unix timestamp; at/above it,
// it's already in milliseconds (a seconds-precision timestamp only reaches
// this many digits in the year 2286).
const SECONDS_TIMESTAMP_MAX = 9999999999;

const MENTOR_FEEDBACK_RECEIVED_TYPES = new Set<string>([
  'feedback_received',
  'reservation_feedback_received',
  'meeting_feedback_received',
]);

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed !== '' ? trimmed : undefined;
}

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
  const isMentorFeedbackReceived = MENTOR_FEEDBACK_RECEIVED_TYPES.has(
    apiItem.type
  );
  const metadata = (apiItem.metadata || {}) as {
    role?: 'mentor' | 'mentee';
    actor_role?: 'mentor' | 'mentee' | 'system';
    counterparty_name?: string;
    mentee_name?: string;
    menteeName?: string;
    mentor_name?: string;
    mentorName?: string;
    reservation_id?: number | string | null;
    reservationId?: number | string | null;
    reserve_id?: number | string | null;
    dtstart?: number;
    dtend?: number;
  };
  const { role, actor_role, counterparty_name, dtstart, dtend } = metadata;

  const resolvedRole =
    role ?? (isMentorFeedbackReceived ? 'mentor' : undefined);
  const explicitMenteeName =
    normalizeOptionalString(metadata.mentee_name) ??
    normalizeOptionalString(metadata.menteeName);
  const explicitMentorName =
    normalizeOptionalString(metadata.mentor_name) ??
    normalizeOptionalString(metadata.mentorName);

  // Map role and counterparty_name to menteeName/mentorName for frontend compatibility
  const menteeName =
    resolvedRole === 'mentor'
      ? (normalizeOptionalString(counterparty_name) ?? explicitMenteeName)
      : explicitMenteeName;
  const mentorName =
    resolvedRole === 'mentee'
      ? (normalizeOptionalString(counterparty_name) ?? explicitMentorName)
      : explicitMentorName;
  const rawReservationId =
    metadata.reservation_id ?? metadata.reservationId ?? metadata.reserve_id;
  const normalizedReservationId =
    typeof rawReservationId === 'number' && Number.isFinite(rawReservationId)
      ? String(rawReservationId)
      : typeof rawReservationId === 'string' && rawReservationId.trim() !== ''
        ? rawReservationId.trim()
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
    role: resolvedRole,
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
