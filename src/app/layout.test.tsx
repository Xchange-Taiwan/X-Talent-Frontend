import fs from 'node:fs';
import path from 'node:path';

import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  getTraceData: () => ({ 'sentry-trace': 'test-trace' }),
}));

vi.mock('next/script', () => ({
  default: ({ id, src }: { id?: string; src?: string }) => (
    <div data-testid={id ?? 'next-script'} data-src={src} />
  ),
}));

vi.mock('@/components/AnalyticsBootstrap', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/components/AnalyticsBootstrap')>();
  const ActualAnalyticsBootstrap = actual.default;
  return {
    ...actual,
    default: ({
      gaId,
      clarityId,
    }: {
      gaId?: string | null;
      clarityId?: string | null;
    }) => (
      <>
        <ActualAnalyticsBootstrap gaId={gaId} clarityId={clarityId} />
        <div
          data-testid="analytics-bootstrap"
          data-ga-id={gaId ?? ''}
          data-clarity-id={clarityId ?? ''}
        />
      </>
    ),
  };
});

vi.mock('./font', () => ({
  notoSansTC: { className: 'mock-noto-sans-tc' },
}));

vi.mock('@/components/layout/AnnouncementBanner', () => ({
  AnnouncementBanner: () => <div data-testid="announcement-banner" />,
}));

vi.mock('@/components/layout/Header', () => ({
  Header: () => <header data-testid="header" />,
}));

vi.mock('@/components/layout/Footer', () => ({
  Footer: () => <footer data-testid="footer" />,
}));

vi.mock('@/components/Providers', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

import AnalyticsBootstrap from '@/components/AnalyticsBootstrap';
import {
  resetAnalyticsUserState,
  trackEvent,
  trackPageView,
} from '@/lib/analytics';

import RootLayout, { generateMetadata } from './layout';

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

function clearWindowAnalyticsGlobals(): void {
  delete window.gtag;
  delete window.dataLayer;
  delete window.clarity;
}

describe('RootLayout and global light-mode lock (#861, #902)', () => {
  const originalGaId = process.env.NEXT_PUBLIC_GA_ID;
  const originalClarityId = process.env.NEXT_PUBLIC_CLARITY_ID;

  afterEach(() => {
    resetAnalyticsUserState();
    if (originalGaId === undefined) {
      delete process.env.NEXT_PUBLIC_GA_ID;
    } else {
      process.env.NEXT_PUBLIC_GA_ID = originalGaId;
    }
    if (originalClarityId === undefined) {
      delete process.env.NEXT_PUBLIC_CLARITY_ID;
    } else {
      process.env.NEXT_PUBLIC_CLARITY_ID = originalClarityId;
    }
    clearWindowAnalyticsGlobals();
  });

  it('outputs <meta name="darkreader-lock"> and <meta name="color-scheme" content="light"> in <head>', () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <div data-testid="page-child">Content</div>
      </RootLayout>
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const darkReaderLockMeta = doc.head.querySelector(
      'meta[name="darkreader-lock"]'
    );
    expect(darkReaderLockMeta).not.toBeNull();

    const colorSchemeMeta = doc.head.querySelector('meta[name="color-scheme"]');
    expect(colorSchemeMeta).not.toBeNull();
    expect(colorSchemeMeta?.getAttribute('content')).toBe('light');
  });

  it('declares color-scheme: light on :root and html in src/styles/global.css', () => {
    const globalCssPath = path.resolve(process.cwd(), 'src/styles/global.css');
    const css = fs.readFileSync(globalCssPath, 'utf8');

    expect(css).toMatch(/:root\s*\{[\s\S]*?color-scheme:\s*light;/);
    expect(css).toMatch(/html\s*\{[\s\S]*?color-scheme:\s*light;/);
    expect(css).not.toMatch(/prefers-color-scheme:\s*dark/);
  });

  it('generates site metadata with sentry trace data', () => {
    const metadata = generateMetadata();

    expect(metadata.title).toEqual({
      default: 'XChange Talent Pool',
      template: '%s | XChange Talent Pool',
    });
    expect(metadata.other).toEqual(
      expect.objectContaining({
        'sentry-trace': 'test-trace',
      })
    );
  });

  it('renders unified AnalyticsBootstrap + external afterInteractive GA4 and Clarity scripts without inline dangerouslySetInnerHTML (#865, #902)', () => {
    process.env.NEXT_PUBLIC_GA_ID = 'G-TEST123456';
    process.env.NEXT_PUBLIC_CLARITY_ID = 'claritytest1';

    const html = renderToStaticMarkup(
      <RootLayout>
        <div>Content</div>
      </RootLayout>
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');

    expect(
      doc.head.querySelector(
        'link[rel="preconnect"][href="https://www.googletagmanager.com"]'
      )
    ).not.toBeNull();
    expect(
      doc.head.querySelector(
        'link[rel="preconnect"][href="https://www.clarity.ms"]'
      )
    ).not.toBeNull();
    expect(
      doc.head.querySelector(
        'link[rel="preconnect"][href="https://c.clarity.ms"]'
      )
    ).not.toBeNull();
    expect(doc.head.querySelector('script#ga4-init')).toBeNull();
    expect(doc.body.querySelector('script#microsoft-clarity')).toBeNull();

    const bootstrapEl = doc.body.querySelector(
      '[data-testid="analytics-bootstrap"]'
    );
    expect(bootstrapEl).not.toBeNull();
    expect(bootstrapEl?.getAttribute('data-ga-id')).toBe('G-TEST123456');
    expect(bootstrapEl?.getAttribute('data-clarity-id')).toBe('claritytest1');

    expect(
      doc.body.querySelector(
        '[data-src="https://www.googletagmanager.com/gtag/js?id=G-TEST123456"]'
      )
    ).not.toBeNull();
    expect(
      doc.body.querySelector(
        '[data-src="https://www.clarity.ms/tag/claritytest1"]'
      )
    ).not.toBeNull();

    // Execute client mount of AnalyticsBootstrap and verify live window.gtag + window.clarity.q queues
    clearWindowAnalyticsGlobals();
    document.title = 'X-Talent 首頁';
    render(<AnalyticsBootstrap gaId="G-TEST123456" clarityId="claritytest1" />);

    expect(typeof window.gtag).toBe('function');
    expect(typeof window.clarity).toBe('function');
    expect(window.dataLayer).toHaveLength(2);
    expect(Object.prototype.toString.call(window.dataLayer?.[0])).toBe(
      '[object Arguments]'
    );
    expect(toQueueTuple(window.dataLayer?.[0])).toEqual([
      'js',
      expect.any(Date),
    ]);
    expect(toQueueTuple(window.dataLayer?.[1])).toEqual([
      'config',
      'G-TEST123456',
      expect.objectContaining({ send_page_view: false }),
    ]);

    trackPageView('/');
    expect(toQueueTuple(window.dataLayer?.[2])).toEqual([
      'event',
      'page_view',
      expect.objectContaining({
        page_path: '/',
        page_title: 'X-Talent 首頁',
        user_role: 'guest',
      }),
    ]);

    trackEvent({ name: 'sign_up_started', feature: 'auth' });
    const clarityQueue = (window.clarity?.q ?? []).map(toQueueTuple);
    expect(clarityQueue).toEqual([
      ['event', 'sign_up_started'],
      ['set', 'feature', 'auth'],
      ['set', 'user_role', 'guest'],
    ]);
  });

  it('omits GA4 and Clarity preconnects, bootstrap, and scripts when IDs are unset or malformed (#865, #902)', () => {
    process.env.NEXT_PUBLIC_GA_ID = 'invalid"><script>alert(1)</script>';
    process.env.NEXT_PUBLIC_CLARITY_ID = 'clarity"><script>alert(1)</script>';

    const html = renderToStaticMarkup(
      <RootLayout>
        <div>Content</div>
      </RootLayout>
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');

    expect(
      doc.head.querySelector(
        'link[rel="preconnect"][href="https://www.googletagmanager.com"]'
      )
    ).toBeNull();
    expect(
      doc.head.querySelector(
        'link[rel="preconnect"][href="https://www.clarity.ms"]'
      )
    ).toBeNull();
    expect(
      doc.head.querySelector(
        'link[rel="preconnect"][href="https://c.clarity.ms"]'
      )
    ).toBeNull();
    expect(
      doc.body.querySelector('[data-testid="analytics-bootstrap"]')
    ).toBeNull();
    expect(doc.body.querySelector('[data-src*="googletagmanager"]')).toBeNull();
    expect(doc.body.querySelector('[data-src*="clarity.ms"]')).toBeNull();
  });
});
