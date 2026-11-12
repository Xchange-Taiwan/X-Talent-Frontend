import { components } from '@/types/api';

import type { NotificationItem } from './types';

// Below this, created_at is a seconds-precision Unix timestamp; at/above it,
// it's already in milliseconds (a seconds-precision timestamp only reaches
// this many digits in the year 2286).
const SECONDS_TIMESTAMP_MAX = 9999999999;
const BACKSLASH_CHAR = String.fromCharCode(92);

const ALLOWED_RESERVATION_PATHS = new Set([
  '/reservation/mentor',
  '/reservation/mentee',
  '/reservation',
]);

function pickNonEmptyString(candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      return candidate.trim();
    }
  }
  return undefined;
}

function normalizeReservationId(rawId: unknown): string | undefined {
  if (typeof rawId === 'number' && Number.isFinite(rawId)) {
    return String(rawId);
  }
  if (typeof rawId === 'string' && rawId.trim() !== '') {
    return rawId.trim();
  }
  return undefined;
}

/**
 * Normalizes a backend `session_link` (relative path or full site URL) into a
 * safe internal reservation route, stripping any external origin to prevent
 * open redirects while preserving `tab=history` and `reservation_id`.
 */
export function normalizeNotificationSessionLink(
  rawLink: unknown,
  fallbackReservationId?: string
): string | undefined {
  if (typeof rawLink !== 'string') {
    return undefined;
  }

  const trimmed = rawLink.trim();
  if (
    !trimmed ||
    trimmed.startsWith('//') ||
    trimmed.includes(BACKSLASH_CHAR)
  ) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed, 'https://x-talent.local');
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return undefined;
    }

    if (!ALLOWED_RESERVATION_PATHS.has(parsed.pathname)) {
      return undefined;
    }

    const targetPathname =
      parsed.pathname === '/reservation'
        ? '/reservation/mentor'
        : parsed.pathname;

    if (!parsed.searchParams.has('tab')) {
      parsed.searchParams.set('tab', 'history');
    }

    if (
      fallbackReservationId &&
      !parsed.searchParams.has('reservation_id') &&
      !parsed.searchParams.has('reservationId')
    ) {
      parsed.searchParams.set('reservation_id', fallbackReservationId);
    }

    const search = parsed.searchParams.toString();
    return search ? `${targetPathname}?${search}` : targetPathname;
  } catch {
    return undefined;
  }
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
  const rawRole = metadata.role;
  const role =
    rawRole === 'mentor' || rawRole === 'mentee' ? rawRole : undefined;
  const rawActorRole = metadata.actor_role;
  const actor_role =
    rawActorRole === 'mentor' ||
    rawActorRole === 'mentee' ||
    rawActorRole === 'system'
      ? rawActorRole
      : undefined;
  const {
    counterparty_name,
    mentee_name,
    author_name,
    author_masked_name,
    reservation_id,
    reservationId: camelReservationId,
    session_link,
    sessionLink: camelSessionLink,
    dtstart,
    dtend,
  } = metadata;

  const resolvedRole =
    role ??
    (apiItem.type === 'reservation_feedback_received' ? 'mentor' : undefined);

  // Map role and counterparty_name to menteeName/mentorName for frontend compatibility
  const menteeName =
    resolvedRole === 'mentor'
      ? pickNonEmptyString([
          counterparty_name,
          mentee_name,
          author_name,
          author_masked_name,
        ])
      : undefined;
  const mentorName =
    resolvedRole === 'mentee' && typeof counterparty_name === 'string'
      ? counterparty_name
      : undefined;

  const normalizedReservationId = normalizeReservationId(
    reservation_id ?? camelReservationId
  );
  const normalizedSessionLink = normalizeNotificationSessionLink(
    session_link ?? camelSessionLink,
    normalizedReservationId
  );

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
    ...(normalizedSessionLink !== undefined
      ? { sessionLink: normalizedSessionLink }
      : {}),
    ...(normalizedDtstart !== undefined ? { dtstart: normalizedDtstart } : {}),
    ...(normalizedDtend !== undefined ? { dtend: normalizedDtend } : {}),
  };
}
