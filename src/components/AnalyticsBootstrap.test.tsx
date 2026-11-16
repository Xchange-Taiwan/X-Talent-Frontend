import { render } from '@testing-library/react';
import React, { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/script', () => ({
  default: ({
    id,
    src,
    strategy,
  }: {
    id?: string;
    src?: string;
    strategy?: string;
  }) => (
    <div
      data-testid={id ?? 'next-script'}
      data-src={src}
      data-strategy={strategy}
    />
  ),
}));

import { resetAnalyticsUserState, trackEvent } from '@/lib/analytics';

import AnalyticsBootstrap from './AnalyticsBootstrap';

function isArrayLikeEntry(val: unknown): val is ArrayLike<unknown> {
  return (
    typeof val === 'object' &&
    val !== null &&
    'length' in val &&
    typeof val.length === 'number'
  );
}

function toQueueTuple(entry: unknown): unknown[] {
  if (!isArrayLikeEntry(entry)) {
    throw new Error('Expected queue entry to be array-like');
  }
  return Array.from(entry);
}

function MountTimeEventEmitter() {
  useEffect(() => {
    trackEvent({ name: 'sign_up_started', feature: 'auth' });
  }, []);
  return null;
}

describe('AnalyticsBootstrap (#902)', () => {
  beforeEach(() => {
    resetAnalyticsUserState();
    delete window.gtag;
    delete window.dataLayer;
    delete window.clarity;
    document.title = '註冊 | XChange Talent Pool';
    window.history.replaceState({}, '', '/auth/signup');
  });

  afterEach(() => {
    resetAnalyticsUserState();
    delete window.gtag;
    delete window.dataLayer;
    delete window.clarity;
    window.history.replaceState({}, '', '/');
  });

  it('initializes GA4 dataLayer and Clarity window.clarity.q before sibling mount useEffects and renders external afterInteractive scripts', () => {
    const { container } = render(
      <React.StrictMode>
        <AnalyticsBootstrap gaId="G-BOOT90201" clarityId="clarity902a" />
        <MountTimeEventEmitter />
      </React.StrictMode>
    );

    const gaScript = container.querySelector('[data-testid="ga4-gtag"]');
    expect(gaScript).not.toBeNull();
    expect(gaScript?.getAttribute('data-src')).toBe(
      'https://www.googletagmanager.com/gtag/js?id=G-BOOT90201'
    );
    expect(gaScript?.getAttribute('data-strategy')).toBe('afterInteractive');

    const clarityScript = container.querySelector(
      '[data-testid="microsoft-clarity"]'
    );
    expect(clarityScript).not.toBeNull();
    expect(clarityScript?.getAttribute('data-src')).toBe(
      'https://www.clarity.ms/tag/clarity902a'
    );
    expect(clarityScript?.getAttribute('data-strategy')).toBe(
      'afterInteractive'
    );

    // Mount-time sign_up_started is queued in both GA4 dataLayer and Clarity window.clarity.q
    expect(typeof window.gtag).toBe('function');
    expect(typeof window.clarity).toBe('function');
    expect(Array.isArray(window.clarity?.q)).toBe(true);

    const clarityCommands = (window.clarity?.q ?? []).map(toQueueTuple);
    expect(clarityCommands).toContainEqual(['event', 'sign_up_started']);
    expect(clarityCommands).toContainEqual(['set', 'feature', 'auth']);
    expect(clarityCommands).toContainEqual(['set', 'user_role', 'guest']);
  });

  it('rejects malformed or script-injection GA4 and Clarity IDs without rendering scripts or initializing globals', () => {
    const { container } = render(
      <AnalyticsBootstrap
        gaId={'G-BAD"><script>alert(1)</script>'}
        clarityId={'clarity"><script>alert(1)</script>'}
      />
    );

    expect(container).toBeEmptyDOMElement();
    expect(window.gtag).toBeUndefined();
    expect(window.clarity).toBeUndefined();
  });
});
