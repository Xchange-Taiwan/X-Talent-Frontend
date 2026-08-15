import { get } from '@vercel/global-config';
import { NextResponse } from 'next/server';

import { captureApiFailure } from '@/lib/monitoring';
import type { AnnouncementData } from '@/services/announcement';

export const dynamic = 'force-dynamic';

export async function GET() {
  let announcement: AnnouncementData | null = null;

  if (process.env.GLOBAL_CONFIG || process.env.EDGE_CONFIG) {
    const startTime = Date.now();
    try {
      // Read through the SDK rather than a raw fetch to the connection
      // string — the SDK resolves the correct sub-path/format for a single
      // item internally, which a bare fetch to the base connection string
      // does not. Bare get() still falls back to EDGE_CONFIG when
      // GLOBAL_CONFIG is unset: its init() resolves the connection string
      // via `GLOBAL_CONFIG ?? EDGE_CONFIG` before every call, same as in
      // middleware.ts, so no explicit createClient() call is needed here.
      announcement = (await get<AnnouncementData>('announcement')) ?? null;
    } catch (error) {
      // Unlike apiClient, the SDK doesn't report into this project's
      // monitoring — do it here so a broken store/token doesn't silently
      // fall through to the mock fallback unnoticed. captureApiFailure()
      // already runs both endpoint and message through sanitize() (masks
      // `token=`/`password=`/etc. query params and JSON values), so no
      // extra masking is needed here even if error.message ever echoes
      // back the connection string.
      captureApiFailure({
        endpoint: 'global-config:announcement',
        method: 'GET',
        status: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
      // Fall through to the local fallback below.
    }
  }

  // Fallback to local environment variables if Edge Config is not configured/available
  if (!announcement) {
    const enabled = process.env.MOCK_ANNOUNCEMENT_ENABLED === 'true';
    const message = process.env.MOCK_ANNOUNCEMENT_MESSAGE || '';
    const maintenanceTime = process.env.MOCK_ANNOUNCEMENT_TIME || '';

    announcement = {
      enabled,
      message,
      maintenanceTime,
    };
  }

  return NextResponse.json(announcement);
}
