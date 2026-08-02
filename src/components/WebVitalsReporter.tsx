'use client';

import { useReportWebVitals } from 'next/web-vitals';

import { trackEvent } from '@/lib/analytics';

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    const name = metric.name.toUpperCase();
    if (['LCP', 'CLS', 'INP', 'FCP', 'TTFB'].includes(name)) {
      trackEvent({
        name: `performance_${metric.name.toLowerCase()}_measured`,
        feature: 'performance',
        metadata: {
          raw_value: metric.value,
          rating: metric.rating,
        },
      });
    }
  });

  return null;
}
