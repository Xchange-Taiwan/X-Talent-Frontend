import fs from 'node:fs';
import path from 'node:path';

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

import RootLayout, { generateMetadata } from './layout';

describe('RootLayout and global light-mode lock (#861)', () => {
  const originalGaId = process.env.NEXT_PUBLIC_GA_ID;

  afterEach(() => {
    if (originalGaId === undefined) {
      delete process.env.NEXT_PUBLIC_GA_ID;
    } else {
      process.env.NEXT_PUBLIC_GA_ID = originalGaId;
    }
    delete window.gtag;
    delete window.dataLayer;
    document.getElementById('ga4-init')?.remove();
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

  it('injects GA4 queue stub with data-ga-id + send_page_view:false and afterInteractive gtag.js when NEXT_PUBLIC_GA_ID is valid (#865)', () => {
    process.env.NEXT_PUBLIC_GA_ID = 'G-TEST123456';

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

    const gaInitScript = doc.head.querySelector('script#ga4-init');
    expect(gaInitScript).not.toBeNull();
    expect(gaInitScript?.getAttribute('data-ga-id')).toBe('G-TEST123456');
    expect(gaInitScript?.textContent).toContain('{send_page_view:false}');
    expect(gaInitScript?.textContent).not.toContain('G-TEST123456');

    expect(
      doc.body.querySelector(
        '[data-src="https://www.googletagmanager.com/gtag/js?id=G-TEST123456"]'
      )
    ).not.toBeNull();
  });

  it('omits GA4 scripts when NEXT_PUBLIC_GA_ID is unset or malformed (#865)', () => {
    process.env.NEXT_PUBLIC_GA_ID = 'invalid"><script>alert(1)</script>';

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
    expect(doc.head.querySelector('script#ga4-init')).toBeNull();
    expect(doc.body.querySelector('[data-src*="googletagmanager"]')).toBeNull();
  });
});
