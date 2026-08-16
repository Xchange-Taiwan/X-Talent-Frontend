import { get } from '@vercel/global-config';

import { captureApiFailure } from '@/lib/monitoring';
import type { AnnouncementData } from '@/services/announcement';

/**
 * ============================================================================
 * DOCUMENTATION FOR CI WORKFLOW & MANAGEMENT-API CO-EXISTENCE:
 *
 * The GitHub Action workflow `.github/workflows/toggle-maintenance.yml` also
 * reads and writes to the Vercel Global Config store.
 *
 * It acts as an intentionally separate, CI-only adapter because it operates
 * in a completely different authorization context (running inside GitHub Actions
 * runner using standard curl/bash/jq directly against Vercel Management API).
 *
 * To avoid silent schema drift, any schema/structure changes to either:
 *   - 'isInMaintenanceMode' (boolean)
 *   - 'announcement' (AnnouncementData)
 * MUST be coordinated in both places. This shared module serves as the primary
 * source of truth for the runtime/application reads.
 * ============================================================================
 */

/**
 * Shared helper to read from Vercel Global Config with a timeout race
 * and automated failure reporting to monitoring (Sentry).
 */
async function readWithTimeoutAndReporting<T>(
  key: string,
  timeoutMs = 500
): Promise<{ success: boolean; value: T | null }> {
  const startTime = Date.now();
  let isSettled = false;

  return new Promise((resolve) => {
    // Shared settlement logic to prevent race conditions and double reporting
    const settle = (
      success: boolean,
      value: T | null,
      errorToReport?: unknown,
      timeoutMessage?: string
    ) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);

      const duration = Date.now() - startTime;

      try {
        if (timeoutMessage) {
          console.warn(timeoutMessage);
          Promise.resolve(
            captureApiFailure({
              endpoint: `global-config:${key}`,
              method: 'GET',
              status: 0,
              message: timeoutMessage,
              duration,
            })
          ).catch((logErr) => {
            console.error(
              `Failed to log timeout monitoring event for key ${key}:`,
              logErr
            );
          });
        } else if (errorToReport !== undefined) {
          const message =
            errorToReport instanceof Error
              ? errorToReport.message
              : 'Unknown error';

          // Log safe message locally to prevent credentials/token leaks from raw error objects
          console.error(`Global Config read failed for key ${key}: ${message}`);

          Promise.resolve(
            captureApiFailure({
              endpoint: `global-config:${key}`,
              method: 'GET',
              status: 0,
              message,
              duration,
            })
          ).catch((logErr) => {
            console.error(
              `Failed to log failure monitoring event for key ${key}:`,
              logErr
            );
          });
        }
      } catch (logErr) {
        console.error(
          `Failed to report Global Config status for key ${key}:`,
          logErr
        );
      } finally {
        resolve({ success, value });
      }
    };

    const timer = setTimeout(() => {
      settle(
        false,
        null,
        undefined,
        `Global Config read timed out after ${timeoutMs}ms`
      );
    }, timeoutMs);

    try {
      get<T>(key)
        .then((val) => {
          settle(true, val ?? null);
        })
        .catch((err) => {
          settle(false, null, err);
        });
    } catch (err) {
      settle(false, null, err);
    }
  });
}

/**
 * Fetches the maintenance mode status from Global Config.
 */
export async function getMaintenanceMode(
  timeoutMs = 500
): Promise<{ success: boolean; value: boolean }> {
  const result = await readWithTimeoutAndReporting<unknown>(
    'isInMaintenanceMode',
    timeoutMs
  );
  if (!result.success) {
    return { success: false, value: false };
  }
  const value = result.value === true || result.value === 'true';
  return { success: true, value };
}

/**
 * Fetches the announcement banner data from Global Config.
 */
export async function getAnnouncement(
  timeoutMs = 500
): Promise<{ success: boolean; value: AnnouncementData | null }> {
  return readWithTimeoutAndReporting<AnnouncementData>(
    'announcement',
    timeoutMs
  );
}
