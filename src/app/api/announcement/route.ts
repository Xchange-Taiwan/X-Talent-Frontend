import { NextResponse } from 'next/server';

import { apiClient } from '@/lib/apiClient';
import type { AnnouncementData } from '@/services/announcement';

export const dynamic = 'force-dynamic';

export async function GET() {
  let announcement: AnnouncementData | null = null;

  if (process.env.EDGE_CONFIG) {
    try {
      const data = await apiClient.get<{ announcement?: AnnouncementData }>(
        process.env.EDGE_CONFIG,
        { auth: false, next: { revalidate: 0 } } // avoid caching in Next.js
      );
      announcement = data.announcement ?? null;
    } catch {
      // Fetch/response failures are already reported by apiClient's internal
      // error handling (sanitized — the Edge Config URL's token is masked).
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
