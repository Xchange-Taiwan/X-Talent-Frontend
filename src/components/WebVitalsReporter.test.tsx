import { render } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { useReportWebVitals } from 'next/web-vitals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { trackEvent } from '@/lib/analytics';

import WebVitalsReporter from './WebVitalsReporter';

// Mock next/web-vitals
vi.mock('next/web-vitals', () => ({
  useReportWebVitals: vi.fn(),
}));

// Mock @/lib/analytics
vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

describe('WebVitalsReporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers the web vitals reporter callback', () => {
    render(<WebVitalsReporter />);
    expect(useReportWebVitals).toHaveBeenCalledTimes(1);
    expect(useReportWebVitals).toHaveBeenCalledWith(expect.any(Function));
  });

  it('tracks supported metrics (LCP, CLS, INP, FCP, TTFB) with correct parameters', () => {
    let callback: Exclude<Parameters<typeof useReportWebVitals>[0], undefined>;

    vi.mocked(useReportWebVitals).mockImplementation((cb) => {
      callback = cb;
    });

    render(<WebVitalsReporter />);

    const metrics = [
      { name: 'LCP', value: 2500, rating: 'needs-improvement' },
      { name: 'CLS', value: 0.1, rating: 'good' },
      { name: 'INP', value: 150, rating: 'good' },
      { name: 'FCP', value: 1200, rating: 'good' },
      { name: 'TTFB', value: 600, rating: 'poor' },
    ] as const;

    metrics.forEach((metric) => {
      callback!(fromPartial(metric));

      expect(trackEvent).toHaveBeenCalledWith(
        {
          name: `performance_${metric.name.toLowerCase()}_measured`,
          feature: 'performance',
          metadata: {
            raw_value: metric.value,
            rating: metric.rating,
          },
        },
        { skipClarity: true }
      );
    });
  });

  it('ignores unsupported metrics', () => {
    let callback: Exclude<Parameters<typeof useReportWebVitals>[0], undefined>;

    vi.mocked(useReportWebVitals).mockImplementation((cb) => {
      callback = cb;
    });

    render(<WebVitalsReporter />);

    callback!(fromPartial({ name: 'FID', value: 50, rating: 'good' }));
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
