'use client';

import { useInsertionEffect } from 'react';

import { initGa4 } from '@/lib/analytics';

export interface Ga4BootstrapProps {
  gaId: string;
}

/**
 * Initializes the GA4 `window.dataLayer` / `window.gtag` command queue via a
 * typed client module (no inline `<script>` or string concatenation), running
 * inside `useInsertionEffect` before `PageViewTracker`'s `useEffect` dispatches
 * the initial `page_view`.
 */
export default function Ga4Bootstrap({ gaId }: Ga4BootstrapProps): null {
  useInsertionEffect(() => {
    initGa4(gaId);
  }, [gaId]);

  return null;
}
