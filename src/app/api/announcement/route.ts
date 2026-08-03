import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  let announcement = null;

  if (process.env.EDGE_CONFIG) {
    try {
      const res = await fetch(process.env.EDGE_CONFIG, {
        next: { revalidate: 0 }, // avoid caching in Next.js
      });
      if (res.ok) {
        const data = await res.json();
        announcement = data.announcement;
      }
    } catch (err) {
      console.error('Failed to fetch Edge Config:', err);
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
