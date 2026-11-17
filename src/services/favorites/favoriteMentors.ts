import { apiClient, ApiError } from '@/lib/apiClient';
import { mapMentor, type RawMentor } from '@/services/search-mentor/mapMentor';
import type { MentorType } from '@/types/mentor';

export interface FavoriteMentorsEnvelope {
  mentors?: RawMentor[] | null;
}

export type RawFavoriteMentorsResponse =
  RawMentor[] | FavoriteMentorsEnvelope | null | undefined;

interface MutationEnvelope {
  code?: string | number | null;
  msg?: string | null;
  data?: unknown;
}

function isMutationEnvelope(value: unknown): value is MutationEnvelope {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractMutationDataMessage(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return undefined;
  }
  const msg = (data as Record<string, unknown>).message;
  return typeof msg === 'string' && msg.trim().length > 0
    ? msg.trim()
    : undefined;
}

function assertMutationSuccess(result: unknown): void {
  if (!isMutationEnvelope(result)) return;
  if (result.code === undefined || result.code === null) return;
  const codeStr = String(result.code);
  if (codeStr !== '0') {
    const numericStatus = Number(codeStr);
    const status =
      !Number.isNaN(numericStatus) &&
      numericStatus >= 400 &&
      numericStatus < 600
        ? numericStatus
        : codeStr === '40300'
          ? 403
          : 400;
    const message =
      (typeof result.msg === 'string' && result.msg.trim()
        ? result.msg.trim()
        : undefined) ??
      extractMutationDataMessage(result.data) ??
      `Request failed with code ${codeStr}`;
    throw new ApiError(status, message, codeStr, result.data);
  }
}

function resolveEncodedUserId(userId: string | number): string {
  if (typeof userId === 'number') {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new Error(
        'userId must be a positive safe integer or non-empty string'
      );
    }
    return encodeURIComponent(String(userId));
  }
  const normalized = String(userId ?? '').trim();
  if (!normalized) {
    throw new Error('userId is required for favorite mentors API');
  }
  return encodeURIComponent(normalized);
}

function resolveEncodedMentorId(mentorId: number): string {
  if (!Number.isSafeInteger(mentorId) || mentorId <= 0) {
    throw new Error('mentorId must be a positive safe integer');
  }
  return encodeURIComponent(String(mentorId));
}

export function extractRawFavoriteMentors(
  raw: RawFavoriteMentorsResponse
): RawMentor[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Array.isArray(raw.mentors) ? raw.mentors : [];
}

/**
 * Fetches the authenticated user's favorited mentors list
 * (`GET /api/v1/users/{user_id}/favorite-mentors`).
 * Supports both `RawMentor[]` and `{ mentors: RawMentor[] }` wire shapes,
 * and silently returns `[]` on HTTP 404 before backend #759 is deployed.
 */
export async function fetchFavoriteMentors(
  userId: string | number,
  signal?: AbortSignal
): Promise<MentorType[]> {
  const encodedUserId = resolveEncodedUserId(userId);
  try {
    const data = await apiClient.getUnwrapped<RawFavoriteMentorsResponse>(
      `/v1/users/${encodedUserId}/favorite-mentors`,
      {
        auth: true,
        signal,
      }
    );
    return extractRawFavoriteMentors(data).map((mentor) => mapMentor(mentor));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }
    throw error;
  }
}

/**
 * Idempotently adds a mentor to the authenticated user's favorites
 * (`PUT /api/v1/users/{user_id}/favorite-mentors/{mentor_id}`).
 */
export async function addFavoriteMentor(
  userId: string | number,
  mentorId: number,
  signal?: AbortSignal
): Promise<void> {
  const encodedUserId = resolveEncodedUserId(userId);
  const encodedMentorId = resolveEncodedMentorId(mentorId);
  const result = await apiClient.put<unknown>(
    `/v1/users/${encodedUserId}/favorite-mentors/${encodedMentorId}`,
    undefined,
    {
      auth: true,
      signal,
    }
  );
  assertMutationSuccess(result);
}

/**
 * Idempotently removes a mentor from the authenticated user's favorites
 * (`DELETE /api/v1/users/{user_id}/favorite-mentors/{mentor_id}`).
 */
export async function removeFavoriteMentor(
  userId: string | number,
  mentorId: number,
  signal?: AbortSignal
): Promise<void> {
  const encodedUserId = resolveEncodedUserId(userId);
  const encodedMentorId = resolveEncodedMentorId(mentorId);
  const result = await apiClient.delete<unknown>(
    `/v1/users/${encodedUserId}/favorite-mentors/${encodedMentorId}`,
    undefined,
    {
      auth: true,
      signal,
    }
  );
  assertMutationSuccess(result);
}
