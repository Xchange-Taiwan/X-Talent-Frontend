'use client';

import * as Sentry from '@sentry/nextjs';
import { useReportWebVitals } from 'next/web-vitals';

export default function WebVitalsMonitor() {
  useReportWebVitals((metric) => {
    Sentry.captureEvent({
      message: `web_vital.${metric.name.toLowerCase()}`,
      level: 'info',
      tags: {
        event_name: `web_vital.${metric.name.toLowerCase()}`,
        vital_name: metric.name,
        vital_rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
      },
      extra: {
        value: Math.round(metric.value),
        delta: Math.round(metric.delta),
        id: metric.id,
        navigationType: metric.navigationType,
      },
    });
  });

  return null;
}
