'use client';

import { useReportWebVitals } from 'next/web-vitals';

import { trackEvent } from '@/lib/analytics';

const SUPPORTED_METRICS = ['LCP', 'CLS', 'INP', 'FCP', 'TTFB'];

interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

function reportWebVitals(metric: WebVitalsMetric) {
  const name = metric.name.toUpperCase();
  if (SUPPORTED_METRICS.includes(name)) {
    trackEvent({
      name: `performance_${metric.name.toLowerCase()}_measured`,
      feature: 'performance',
      metadata: {
        raw_value: metric.value,
        rating: metric.rating,
      },
      skipClarity: true,
    });
  }
}

export default function WebVitalsReporter() {
  useReportWebVitals(reportWebVitals);

  return null;
}
