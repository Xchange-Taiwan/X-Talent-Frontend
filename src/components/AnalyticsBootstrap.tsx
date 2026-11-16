'use client';

import Script from 'next/script';
import { useInsertionEffect } from 'react';

import {
  initClarity,
  initGa4,
  isValidClarityProjectId,
  isValidGaMeasurementId,
} from '@/lib/analytics';

export interface AnalyticsBootstrapProps {
  gaId?: string | null;
  clarityId?: string | null;
  /** Suppresses external `<Script>` tags in isolated sandboxes (e.g. Storybook) */
  disableExternalScripts?: boolean;
}

/**
 * Unified client bootstrap for Google Analytics 4 and Microsoft Clarity.
 *
 * Initializes both `window.dataLayer` / `window.gtag` and `window.clarity` /
 * `window.clarity.q` inside `useInsertionEffect` (before any component `useEffect`
 * fires), and loads external `gtag.js` and `clarity.ms/tag/<id>` scripts via
 * `next/script` `afterInteractive` without inline `<script>` string interpolation.
 */
export default function AnalyticsBootstrap({
  gaId,
  clarityId,
  disableExternalScripts = false,
}: AnalyticsBootstrapProps) {
  const trimmedGaId = gaId?.trim() ?? '';
  const safeGaId = isValidGaMeasurementId(trimmedGaId) ? trimmedGaId : null;
  const trimmedClarityId = clarityId?.trim() ?? '';
  const safeClarityId = isValidClarityProjectId(trimmedClarityId)
    ? trimmedClarityId
    : null;

  useInsertionEffect(() => {
    if (safeGaId) {
      initGa4(safeGaId);
    }
    if (safeClarityId) {
      initClarity(safeClarityId);
    }
  }, [safeGaId, safeClarityId]);

  if (disableExternalScripts || (!safeGaId && !safeClarityId)) {
    return null;
  }

  return (
    <>
      {safeGaId && (
        <Script
          id="ga4-gtag"
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(safeGaId)}`}
          strategy="afterInteractive"
        />
      )}
      {safeClarityId && (
        <Script
          id="microsoft-clarity"
          src={`https://www.clarity.ms/tag/${encodeURIComponent(safeClarityId)}`}
          strategy="afterInteractive"
        />
      )}
    </>
  );
}
