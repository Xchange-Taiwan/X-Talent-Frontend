import '../styles/global.css';

import * as Sentry from '@sentry/nextjs';
import type { Metadata } from 'next';

import AnalyticsBootstrap from '@/components/AnalyticsBootstrap';
import { AnnouncementBanner } from '@/components/layout/AnnouncementBanner';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import Providers from '@/components/Providers';
import { Toaster } from '@/components/ui/toaster';
import {
  isValidClarityProjectId,
  isValidGaMeasurementId,
} from '@/lib/analytics';
import { SESSION_HINT_INLINE_SCRIPT } from '@/lib/auth/sessionHint';
import { getSiteUrl } from '@/lib/site-url';

import { notoSansTC } from './font';

const SITE_URL = getSiteUrl();
const SITE_DESCRIPTION =
  'XChange Talent Pool 是連結業界導師與職涯探索者的 mentorship 平台，協助你在轉職、升遷、跨界探索時，找到對的人聊對的事。';

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: 'XChange Talent Pool',
      template: '%s | XChange Talent Pool',
    },
    description: SITE_DESCRIPTION,
    openGraph: {
      siteName: 'XChange Talent Pool',
      title: 'XChange Talent Pool',
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      locale: 'zh_TW',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'XChange Talent Pool',
      description: SITE_DESCRIPTION,
    },
    robots: {
      index: true,
      follow: true,
    },
    other: {
      ...Sentry.getTraceData(),
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const rawGaId = process.env.NEXT_PUBLIC_GA_ID?.trim() ?? '';
  const gaMeasurementId = isValidGaMeasurementId(rawGaId) ? rawGaId : null;
  const rawClarityId = process.env.NEXT_PUBLIC_CLARITY_ID?.trim() ?? '';
  const clarityProjectId = isValidClarityProjectId(rawClarityId)
    ? rawClarityId
    : null;

  return (
    <html lang="zh-TW" className={`${notoSansTC.className} group/auth-state`}>
      <head>
        <meta name="darkreader-lock" />
        <meta name="color-scheme" content="light" />
        {/* Instant SSR-Hint CSS Toggle script */}
        <script
          dangerouslySetInnerHTML={{
            __html: SESSION_HINT_INLINE_SCRIPT,
          }}
        />
        {/* Preconnect to third-party origins so the TLS handshake overlaps with
            HTML parse instead of blocking the first script byte. crossOrigin
            is required so the warmed connection is reused for the actual
            (CORS-credentialed) script fetch. */}
        {gaMeasurementId && (
          <link
            rel="preconnect"
            href="https://www.googletagmanager.com"
            crossOrigin="anonymous"
          />
        )}
        {clarityProjectId && (
          <>
            <link
              rel="preconnect"
              href="https://www.clarity.ms"
              crossOrigin="anonymous"
            />
            <link
              rel="preconnect"
              href="https://c.clarity.ms"
              crossOrigin="anonymous"
            />
          </>
        )}
        {process.env.NEXT_PUBLIC_SENTRY_DSN && (
          <link
            rel="preconnect"
            href="https://browser.sentry-cdn.com"
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body id="app">
        <a
          href="#main-content"
          className="focus:bg-brand-500 focus:text-text-primary focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:px-4 focus:py-2 focus:shadow-lg focus:ring-2 focus:ring-offset-2 focus:outline-none"
        >
          跳至主要內容
        </a>
        {/* Google Analytics 4 & Microsoft Clarity — AnalyticsBootstrap initializes
            the typed dataLayer/gtag and clarity.q command queues in a client module
            (no inline script interpolation), loading external scripts via afterInteractive. */}
        {(gaMeasurementId || clarityProjectId) && (
          <AnalyticsBootstrap
            gaId={gaMeasurementId}
            clarityId={clarityProjectId}
          />
        )}
        <Providers>
          <div className="flex min-h-screen flex-col">
            <AnnouncementBanner />
            <Header />
            <main
              id="main-content"
              tabIndex={-1}
              className="grow pt-[calc(70px_+_var(--banner-height,0px))] focus:outline-none"
            >
              {children}
            </main>
            <Footer />
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
