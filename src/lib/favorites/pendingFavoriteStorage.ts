export const PENDING_FAVORITE_MENTOR_STORAGE_KEY =
  'xtalent:pending-favorite-mentor';

export const PENDING_FAVORITE_TTL_MS = 30 * 60 * 1000;

export interface PendingFavoriteMentorRecord {
  mentorId: number;
  createdAt: number;
}

function isValidMentorId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isValidCreatedAt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function clearPendingFavoriteMentor(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(PENDING_FAVORITE_MENTOR_STORAGE_KEY);
  } catch {
    // Ignore storage access errors in restricted browsing contexts
  }
}

export function savePendingFavoriteMentor(
  mentorId: number,
  now: number = Date.now()
): void {
  if (typeof window === 'undefined') return;
  if (!isValidMentorId(mentorId) || !isValidCreatedAt(now)) return;

  const record: PendingFavoriteMentorRecord = {
    mentorId,
    createdAt: now,
  };

  try {
    window.localStorage.setItem(
      PENDING_FAVORITE_MENTOR_STORAGE_KEY,
      JSON.stringify(record)
    );
  } catch {
    // Ignore storage quota or private mode errors
  }
}

export function getPendingFavoriteMentorId(
  now: number = Date.now()
): number | null {
  if (typeof window === 'undefined') return null;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PENDING_FAVORITE_MENTOR_STORAGE_KEY);
  } catch {
    return null;
  }

  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      clearPendingFavoriteMentor();
      return null;
    }

    const mentorId = parsed.mentorId;
    const createdAt = parsed.createdAt;

    if (!isValidMentorId(mentorId) || !isValidCreatedAt(createdAt)) {
      clearPendingFavoriteMentor();
      return null;
    }

    if (now - createdAt > PENDING_FAVORITE_TTL_MS) {
      clearPendingFavoriteMentor();
      return null;
    }

    return mentorId;
  } catch {
    clearPendingFavoriteMentor();
    return null;
  }
}

export function getPendingFavoriteProfilePath(
  now: number = Date.now()
): string | null {
  const mentorId = getPendingFavoriteMentorId(now);
  return mentorId !== null ? `/profile/${mentorId}` : null;
}

export function consumePendingFavoriteMentorForPage(
  pageMentorId: number,
  now: number = Date.now()
): boolean {
  if (!isValidMentorId(pageMentorId)) return false;

  const pendingMentorId = getPendingFavoriteMentorId(now);
  if (pendingMentorId === null || pendingMentorId !== pageMentorId) {
    return false;
  }

  clearPendingFavoriteMentor();
  return true;
}
