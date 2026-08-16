import { NextResponse } from 'next/server';

import { getAnnouncement } from '@/lib/globalConfig';
import type { AnnouncementData } from '@/services/announcement';

export const dynamic = 'force-dynamic';

export async function GET() {
  let announcement: AnnouncementData | null = null;

  if (process.env.GLOBAL_CONFIG || process.env.EDGE_CONFIG) {
    const result = await getAnnouncement(500);
    if (result.success) {
      announcement = result.value;
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
