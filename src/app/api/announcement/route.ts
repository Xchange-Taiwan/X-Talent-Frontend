import { get } from '@vercel/global-config';
import { NextResponse } from 'next/server';

import type { AnnouncementData } from '@/services/announcement';

export const dynamic = 'force-dynamic';

export async function GET() {
  let announcement: AnnouncementData | null = null;

  if (process.env.GLOBAL_CONFIG || process.env.EDGE_CONFIG) {
    try {
      // Read through the SDK rather than a raw fetch to the connection
      // string — the SDK resolves the correct sub-path/format for a single
      // item internally, which a bare fetch to the base connection string
      // does not.
      announcement = (await get<AnnouncementData>('announcement')) ?? null;
    } catch {
      // Fetch/response failures are already reported by the SDK's internal
      // error handling. Fall through to the local fallback below.
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
