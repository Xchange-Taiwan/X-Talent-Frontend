import { getSession } from 'next-auth/react';

import { apiClient, ApiError, FetchApiError } from '@/lib/apiClient';
import { captureFlowFailure } from '@/lib/monitoring';
import type { MentorProfileVO } from '@/types/user';

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function shouldRetry(error: unknown): boolean {
  if (error instanceof ApiError) {
    // 4xx client errors (like 404, 401, 403) shouldn't be retried
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
  }
  if (error instanceof FetchApiError) {
    // Structured API errors (like "User not found") shouldn't be retried
    return false;
  }
  return true;
}

export async function fetchUser(
  language: string,
  signal?: AbortSignal
): Promise<MentorProfileVO | null> {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error('未找到使用者 ID。請重新登入。');
  }

  return fetchUserById(Number(userId), language, signal);
}

export async function fetchUserById(
  userId: number,
  language: string,
  signal?: AbortSignal
): Promise<MentorProfileVO | null> {
  const maxRetries = 1;
  let attempt = 0;

  while (true) {
    try {
      const data = await apiClient.getUnwrapped<MentorProfileVO>(
        `/v1/mentors/${userId}/${language}/profile`,
        { auth: false, signal }
      );

      return data ?? null;
    } catch (error) {
      if (isAbortError(error)) throw error;

      if (!shouldRetry(error)) {
        console.error('Fetch User Error (non-retryable):', error);
        throw error;
      }

      attempt++;
      if (attempt > maxRetries) {
        console.error(`Fetch User Error (after ${attempt} attempts):`, error);

        // Track the connection/network/server failure in monitoring
        captureFlowFailure({
          flow: 'profile',
          step: 'fetch_user_profile',
          message: error instanceof Error ? error.message : 'Load failed',
          errorCode: error instanceof ApiError ? error.status : 'network_error',
        }).catch((monError) => {
          console.error('Failed to log flow failure:', monError);
        });

        throw error; // Rethrow to trigger hook-level error handling
      }

      console.warn(
        `Fetch User failed, retrying (attempt ${attempt})...`,
        error
      );
      // Wait a short delay before retrying (300ms)
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}
