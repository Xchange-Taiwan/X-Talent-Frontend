import { get } from '@vercel/global-config';

import { captureApiFailure, sanitize } from '@/lib/monitoring';
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

      // Resolve immediately to avoid blocking the caller's response
      resolve({ success, value });

      // Logging and reporting runs asynchronously in the background
      const duration = Date.now() - startTime;
      let logMessage = '';

      if (timeoutMessage) {
        console.warn(timeoutMessage);
        logMessage = timeoutMessage;
      } else if (!success) {
        const rawMessage =
          errorToReport instanceof Error
            ? errorToReport.message
            : typeof errorToReport === 'string' && errorToReport
              ? errorToReport
              : 'Unknown error';

        // Sanitize to prevent token leaks
        logMessage = sanitize(rawMessage) ?? 'Unknown error';
        console.error(
          `Global Config read failed for key ${key}: ${logMessage}`
        );
      }

      if (logMessage) {
        try {
          captureApiFailure({
            endpoint: `global-config:${key}`,
            method: 'GET',
            status: 0,
            message: logMessage,
            duration,
          }).catch((logErr) => {
            console.error(
              `Failed to log monitoring event for key ${key}:`,
              logErr
            );
          });
        } catch (logErr) {
          console.error(
            `Synchronous error reporting Global Config status for key ${key}:`,
            logErr
          );
        }
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

function isConfigured(): boolean {
  return Boolean(process.env.GLOBAL_CONFIG || process.env.EDGE_CONFIG);
}

/**
 * Fetches the maintenance mode status from Global Config.
 */
export async function getMaintenanceMode(
  timeoutMs = 500
): Promise<{ success: boolean; value: boolean }> {
  if (!isConfigured()) {
    return { success: true, value: false };
  }
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
  if (!isConfigured()) {
    return { success: true, value: null };
  }
  return readWithTimeoutAndReporting<AnnouncementData>(
    'announcement',
    timeoutMs
  );
}
