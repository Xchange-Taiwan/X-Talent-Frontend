import { apiClient, ApiError } from '@/lib/apiClient';
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
  return true;
}

function isUserNotFoundError(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return true;
    }
    if (error.code === 'USER_NOT_FOUND') {
      return true;
    }
  }
  return false;
}

export async function fetchUserById(
  userId: number,
  language: string,
  signal?: AbortSignal,
  silent = false
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

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (!shouldRetry(error)) {
        if (isUserNotFoundError(error)) {
          return null; // Return null so hook sets "User not found"
        }
        console.error('Fetch User Error (non-retryable):', errorMessage);
        throw error;
      }

      attempt++;
      if (attempt > maxRetries) {
        console.error(
          `Fetch User Error (after ${attempt} attempts):`,
          errorMessage
        );

        // Track the connection/network/server failure in monitoring
        if (!silent) {
          captureFlowFailure({
            flow: 'profile',
            step: 'fetch_user_profile',
            message: errorMessage,
            errorCode:
              error instanceof ApiError ? error.status : 'network_error',
          }).catch((monError) => {
            const monMsg =
              monError instanceof Error ? monError.message : String(monError);
            console.error('Failed to log flow failure:', monMsg);
          });
        }

        throw error; // Rethrow to trigger hook-level error handling
      }

      console.warn(
        `Fetch User failed, retrying (attempt ${attempt})...`,
        errorMessage
      );
      // Wait a short delay before retrying (300ms)
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}
