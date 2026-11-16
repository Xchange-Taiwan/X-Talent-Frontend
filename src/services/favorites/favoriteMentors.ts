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
        : 400;
    const message =
      typeof result.msg === 'string' && result.msg.trim()
        ? result.msg.trim()
        : `Request failed with code ${codeStr}`;
    throw new ApiError(status, message, codeStr, result.data);
  }
}

export function extractRawFavoriteMentors(
  raw: RawFavoriteMentorsResponse
): RawMentor[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Array.isArray(raw.mentors) ? raw.mentors : [];
}

/**
 * Fetches the authenticated user's favorited mentors list.
 * Supports both `RawMentor[]` and `{ mentors: RawMentor[] }` wire shapes,
 * and silently returns `[]` on HTTP 404 before backend #759 is deployed.
 */
export async function fetchFavoriteMentors(
  signal?: AbortSignal
): Promise<MentorType[]> {
  try {
    const data = await apiClient.getUnwrapped<RawFavoriteMentorsResponse>(
      '/v1/me/favorite-mentors',
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
 * Idempotently adds a mentor to the authenticated user's favorites.
 */
export async function addFavoriteMentor(
  mentorId: number,
  signal?: AbortSignal
): Promise<void> {
  const result = await apiClient.put<unknown>(
    `/v1/mentors/${mentorId}/favorite`,
    undefined,
    {
      auth: true,
      signal,
    }
  );
  assertMutationSuccess(result);
}

/**
 * Idempotently removes a mentor from the authenticated user's favorites.
 */
export async function removeFavoriteMentor(
  mentorId: number,
  signal?: AbortSignal
): Promise<void> {
  const result = await apiClient.delete<unknown>(
    `/v1/mentors/${mentorId}/favorite`,
    undefined,
    {
      auth: true,
      signal,
    }
  );
  assertMutationSuccess(result);
}
