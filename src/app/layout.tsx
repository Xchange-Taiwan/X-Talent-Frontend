import '../styles/global.css';

import * as Sentry from '@sentry/nextjs';
import type { Metadata } from 'next';
import Script from 'next/script';

import { AnnouncementBanner } from '@/components/layout/AnnouncementBanner';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import Providers from '@/components/Providers';
import { Toaster } from '@/components/ui/toaster';
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
  return (
    <html lang="zh-TW" className={notoSansTC.className}>
      <head>
        {/* Preconnect to third-party origins so the TLS handshake overlaps with
            HTML parse instead of blocking the first script byte. crossOrigin
            is required so the warmed connection is reused for the actual
            (CORS-credentialed) script fetch. */}
        {process.env.NEXT_PUBLIC_CLARITY_ID && (
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
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-text-primary focus:shadow-lg focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
        >
          跳至主要內容
        </a>
        {/* Google Analytics 4 — only loads when NEXT_PUBLIC_GA_ID is set.
            strategy="afterInteractive" ensures it never blocks page render.
            Page views are tracked by PageViewTracker on route changes. */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
              strategy="afterInteractive"
            />
            <Script
              id="google-analytics"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', { send_page_view: false });
                `,
              }}
            />
          </>
        )}

        {/* Microsoft Clarity — behavior tracking for testing phase.
            Only loads when NEXT_PUBLIC_CLARITY_ID is set.
            strategy="afterInteractive" ensures it never blocks page render. */}
        {process.env.NEXT_PUBLIC_CLARITY_ID && (
          <Script
            id="microsoft-clarity"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window,document,"clarity","script","${process.env.NEXT_PUBLIC_CLARITY_ID}");`,
            }}
          />
        )}
        <Providers>
          <div className="flex min-h-screen flex-col">
            <AnnouncementBanner />
            <Header />
            <main
              id="main-content"
              tabIndex={-1}
              className="grow pt-[calc(70px+var(--banner-height,0px))] focus:outline-none"
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
