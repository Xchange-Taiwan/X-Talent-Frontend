import { components } from '@/types/api';

import type { NotificationItem } from './types';

// Below this, created_at is a seconds-precision Unix timestamp; at/above it,
// it's already in milliseconds (a seconds-precision timestamp only reaches
// this many digits in the year 2286).
const SECONDS_TIMESTAMP_MAX = 9999999999;

type KnownNotificationType = Exclude<NotificationItem['type'], 'unknown'>;

function isKnownNotificationType(
  value: string
): value is KnownNotificationType {
  return (
    value === 'reservation_requested' ||
    value === 'reservation_success' ||
    value === 'reservation_failed' ||
    value === 'reservation_canceled' ||
    value === 'reservation_upcoming' ||
    value === 'feedback_received'
  );
}

function normalizeNotificationType(rawType: unknown): NotificationItem['type'] {
  if (typeof rawType !== 'string') {
    return 'unknown';
  }
  const cleaned = rawType.trim().toLowerCase();
  if (
    cleaned === 'feedback_received' ||
    cleaned === 'reservation_feedback_received' ||
    cleaned === 'meeting_feedback_received' ||
    cleaned === 'mentor_feedback_received' ||
    cleaned === 'new_feedback'
  ) {
    return 'feedback_received';
  }
  if (isKnownNotificationType(cleaned)) {
    return cleaned;
  }
  return 'unknown';
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function normalizeRole(value: unknown): 'mentor' | 'mentee' | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const lower = value.trim().toLowerCase();
  return lower === 'mentor' || lower === 'mentee' ? lower : undefined;
}

function normalizeActorRole(
  value: unknown
): 'mentor' | 'mentee' | 'system' | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const lower = value.trim().toLowerCase();
  return lower === 'mentor' || lower === 'mentee' || lower === 'system'
    ? lower
    : undefined;
}

function extractReservationIdFromSessionLink(
  sessionLink: unknown
): string | undefined {
  if (typeof sessionLink !== 'string' || sessionLink.trim() === '') {
    return undefined;
  }
  try {
    const parsed = new URL(sessionLink.trim(), 'https://xtalent.local');
    const param =
      parsed.searchParams.get('reservationId') ??
      parsed.searchParams.get('reservation_id');
    return param && param.trim() !== '' ? param.trim() : undefined;
  } catch {
    return undefined;
  }
}

function normalizeReservationId(
  metadata: Record<string, unknown>
): string | undefined {
  const rawCandidate = metadata.reservation_id ?? metadata.reservationId;
  if (
    typeof rawCandidate === 'number' &&
    Number.isFinite(rawCandidate) &&
    rawCandidate > 0
  ) {
    return String(rawCandidate);
  }
  if (typeof rawCandidate === 'string' && rawCandidate.trim() !== '') {
    return rawCandidate.trim();
  }
  return extractReservationIdFromSessionLink(metadata.session_link);
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
  const metadata: Record<string, unknown> =
    apiItem.metadata && typeof apiItem.metadata === 'object'
      ? apiItem.metadata
      : {};

  const normalizedType = normalizeNotificationType(apiItem.type);
  const isFeedbackReceived = normalizedType === 'feedback_received';

  const explicitRole = normalizeRole(metadata.role);
  // Feedback-received notifications always target the Mentor recipient.
  const role = isFeedbackReceived ? 'mentor' : explicitRole;
  const actorRole = normalizeActorRole(metadata.actor_role);
  const counterpartyName = readNonEmptyString(metadata.counterparty_name);
  const explicitMenteeName =
    readNonEmptyString(metadata.mentee_name) ??
    readNonEmptyString(metadata.menteeName);
  const explicitMentorName =
    readNonEmptyString(metadata.mentor_name) ??
    readNonEmptyString(metadata.mentorName);

  // Map role and counterparty_name to menteeName/mentorName for frontend compatibility.
  // Feedback-received notifications always display the Mentee's full name.
  const menteeName =
    role === 'mentor'
      ? (counterpartyName ?? explicitMenteeName)
      : explicitMenteeName;
  const mentorName =
    role === 'mentee'
      ? (counterpartyName ?? explicitMentorName)
      : explicitMentorName;
  const reservationId = normalizeReservationId(metadata);
  const normalizedDtstart = readFiniteNumber(metadata.dtstart);
  const normalizedDtend = readFiniteNumber(metadata.dtend);

  // Safe parsed createdAt - handle both seconds and milliseconds timestamps,
  // falling back to now if the backend omits or sends an invalid created_at
  // (otherwise `new Date(undefined).toISOString()` throws RangeError).
  const rawTime = Number(apiItem.created_at) || Date.now();
  const ms = rawTime < SECONDS_TIMESTAMP_MAX ? rawTime * 1000 : rawTime;
  const createdAt = new Date(ms).toISOString();

  return {
    id: String(apiItem.id),
    type: normalizedType,
    createdAt,
    unread: isUnread,
    role,
    actorRole,
    menteeName,
    mentorName,
    ...(reservationId !== undefined ? { reservationId } : {}),
    ...(normalizedDtstart !== undefined ? { dtstart: normalizedDtstart } : {}),
    ...(normalizedDtend !== undefined ? { dtend: normalizedDtend } : {}),
  };
}
