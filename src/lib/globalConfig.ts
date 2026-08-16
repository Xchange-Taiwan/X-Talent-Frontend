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
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const duration = Date.now() - startTime;
      const message = `Global Config read timed out after ${timeoutMs}ms`;
      console.warn(message);

      // Report timeout to monitoring
      captureApiFailure({
        endpoint: `global-config:${key}`,
        method: 'GET',
        status: 0,
        message,
        duration,
      });

      resolve({ success: false, value: null });
    }, timeoutMs);

    try {
      get<T>(key)
        .then((val) => {
          clearTimeout(timer);
          resolve({ success: true, value: val ?? null });
        })
        .catch((err) => {
          clearTimeout(timer);
          const duration = Date.now() - startTime;
          const message = err instanceof Error ? err.message : 'Unknown error';
          console.error(
            `Error reading from Global Config for key ${key}:`,
            err
          );

          // Report SDK read error to monitoring
          captureApiFailure({
            endpoint: `global-config:${key}`,
            method: 'GET',
            status: 0,
            message,
            duration,
          });

          resolve({ success: false, value: null });
        });
    } catch (err) {
      clearTimeout(timer);
      const duration = Date.now() - startTime;
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(
        `Sync error reading from Global Config for key ${key}:`,
        err
      );

      // Report synchronous error to monitoring
      captureApiFailure({
        endpoint: `global-config:${key}`,
        method: 'GET',
        status: 0,
        message,
        duration,
      });

      resolve({ success: false, value: null });
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
