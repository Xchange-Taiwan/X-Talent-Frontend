import { extractDeepLinkReservationId } from '@/lib/reservation/feedbackDeepLink';
import { MENTOR_ONBOARDING_KEY, OPEN_SCHEDULE_DIALOG_KEY } from '@/lib/routes';
import type { Reservation } from '@/types/reservation';

export const PENDING_FEEDBACK_SESSION_PREFIX = 'xtalent:pending-feedback:';

export interface SearchParamReadable {
  get(name: string): string | null;
}

export interface PendingFeedbackRouteContext {
  pathname: string | null;
  searchParams?: SearchParamReadable | null;
}

export function isAuthResetRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === '/auth' || pathname.startsWith('/auth/');
}

/**
 * Determines whether the login-triggered pending-feedback popup (#740) must
 * stay suppressed or yield to another flow:
 * 1. Auth / onboarding flows (`/auth/**`, `/onboarding/**`, or Mentor onboarding
 *    `/profile/[id]/edit?mentor-onboarding=true` / `?onboarding=true`).
 * 2. Reservation / booking flows (`/reservation/**`, `/booking/**`, or
 *    `?open-schedule=true`).
 * 3. Maintenance page (`/maintenance`).
 * 4. URL query parameters targeting a specific reservation deep link
 *    (`reservationId`, `reservation_id`, `feedbackReservationId`, or
 *    `feedback=<reservationId>` via `extractDeepLinkReservationId`) or
 *    `feedback=queue`.
 */
export function shouldSuppressPendingFeedbackPopup({
  pathname,
  searchParams,
}: PendingFeedbackRouteContext): boolean {
  if (!pathname) {
    return true;
  }

  if (
    pathname === '/auth' ||
    pathname.startsWith('/auth/') ||
    pathname === '/onboarding' ||
    pathname.startsWith('/onboarding/') ||
    pathname === '/reservation' ||
    pathname.startsWith('/reservation/') ||
    pathname === '/booking' ||
    pathname.startsWith('/booking/') ||
    pathname === '/maintenance'
  ) {
    return true;
  }

  const isProfileEditRoute = /^\/profile\/[^/]+\/edit$/.test(pathname);
  if (
    isProfileEditRoute &&
    (searchParams?.get(MENTOR_ONBOARDING_KEY) === 'true' ||
      searchParams?.get('onboarding') === 'true')
  ) {
    return true;
  }

  if (searchParams?.get(OPEN_SCHEDULE_DIALOG_KEY) === 'true') {
    return true;
  }

  if (
    searchParams &&
    (extractDeepLinkReservationId(searchParams) !== null ||
      searchParams.get('feedback')?.trim().toLowerCase() === 'queue')
  ) {
    return true;
  }

  return false;
}

/**
 * Sorts pending feedback meetings chronologically by end time (`dtend`) from
 * oldest to newest (`由舊到新`), breaking ties by `dtstart` and `id` (#760 §6).
 */
export function sortPendingFeedbackOldestFirst(
  items: readonly Reservation[]
): Reservation[] {
  return [...items].sort((a, b) => {
    if (a.dtend !== b.dtend) {
      return a.dtend - b.dtend;
    }
    if (a.dtstart !== b.dtstart) {
      return a.dtstart - b.dtstart;
    }
    return String(a.id).localeCompare(String(b.id), undefined, {
      numeric: true,
    });
  });
}

export interface SessionPendingFeedbackState {
  checked: boolean;
  dismissed: boolean;
  queueEmpty: boolean;
  submittedIds: string[];
  skippedIds: string[];
}

const DEFAULT_SESSION_STATE: SessionPendingFeedbackState = {
  checked: false,
  dismissed: false,
  queueEmpty: false,
  submittedIds: [],
  skippedIds: [],
};

function getStorageKey(userId: string): string {
  return `${PENDING_FEEDBACK_SESSION_PREFIX}${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStringIdArray(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
}

export function getSessionPendingFeedbackState(
  userId: string
): SessionPendingFeedbackState {
  if (typeof window === 'undefined' || !userId) {
    return DEFAULT_SESSION_STATE;
  }

  try {
    const raw = window.sessionStorage.getItem(getStorageKey(userId));
    if (!raw) {
      return DEFAULT_SESSION_STATE;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return DEFAULT_SESSION_STATE;
    }
    return {
      checked: Boolean(parsed.checked),
      dismissed: Boolean(parsed.dismissed),
      queueEmpty: Boolean(parsed.queueEmpty),
      submittedIds: parseStringIdArray(parsed.submittedIds),
      skippedIds: parseStringIdArray(parsed.skippedIds),
    };
  } catch {
    return DEFAULT_SESSION_STATE;
  }
}

function writeSessionPendingFeedbackState(
  userId: string,
  next: SessionPendingFeedbackState
): void {
  if (typeof window === 'undefined' || !userId) {
    return;
  }
  try {
    window.sessionStorage.setItem(getStorageKey(userId), JSON.stringify(next));
  } catch {
    // Ignore storage quota / private-mode errors gracefully.
  }
}

export function markSessionPendingFeedbackChecked(
  userId: string,
  hasRemainingItems = false
): void {
  const prev = getSessionPendingFeedbackState(userId);
  writeSessionPendingFeedbackState(userId, {
    ...prev,
    checked: true,
    queueEmpty: !hasRemainingItems,
  });
}

const sessionSubmittedListeners = new Set<
  (userId: string, reservationId: string) => void
>();

export function subscribeSessionReservationSubmitted(
  listener: (userId: string, reservationId: string) => void
): () => void {
  sessionSubmittedListeners.add(listener);
  return () => {
    sessionSubmittedListeners.delete(listener);
  };
}

export function markSessionReservationSubmitted(
  userId: string,
  reservationId: string,
  isQueueNowEmpty = false
): void {
  if (!userId || !reservationId) return;
  const prev = getSessionPendingFeedbackState(userId);
  const nextSubmitted = prev.submittedIds.includes(reservationId)
    ? prev.submittedIds
    : [...prev.submittedIds, reservationId];
  writeSessionPendingFeedbackState(userId, {
    ...prev,
    checked: prev.checked || isQueueNowEmpty,
    queueEmpty: prev.queueEmpty || isQueueNowEmpty,
    submittedIds: nextSubmitted,
  });
  sessionSubmittedListeners.forEach((listener) => {
    listener(userId, reservationId);
  });
}

export function markSessionReservationSkipped(
  userId: string,
  reservationId: string
): void {
  if (!reservationId) return;
  const prev = getSessionPendingFeedbackState(userId);
  const nextSkipped = prev.skippedIds.includes(reservationId)
    ? prev.skippedIds
    : [...prev.skippedIds, reservationId];
  writeSessionPendingFeedbackState(userId, {
    ...prev,
    checked: true,
    skippedIds: nextSkipped,
  });
}

export function markSessionPendingFeedbackDismissed(
  userId: string,
  remainingReservationIds: readonly string[] = []
): void {
  const prev = getSessionPendingFeedbackState(userId);
  const mergedSkipped = Array.from(
    new Set([...prev.skippedIds, ...remainingReservationIds.filter(Boolean)])
  );
  writeSessionPendingFeedbackState(userId, {
    ...prev,
    checked: true,
    dismissed: true,
    skippedIds: mergedSkipped,
  });
}

export function clearAllSessionPendingFeedbackState(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith(PENDING_FEEDBACK_SESSION_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore storage access errors gracefully.
  }
}
