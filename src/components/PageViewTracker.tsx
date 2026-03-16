'use client';

// Tracks SPA page views for GA4 on every client-side route change.
// Mounted once in Providers so it covers the entire app.

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { trackPageView } from '@/lib/analytics';

export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  return null;
}
