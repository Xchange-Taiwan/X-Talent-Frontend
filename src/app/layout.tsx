import '../styles/global.css';

import * as Sentry from '@sentry/nextjs';
import type { Metadata } from 'next';
import Script from 'next/script';
import { getServerSession } from 'next-auth/next';

import authOptions from '@/auth.config';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import Providers from '@/components/Providers';
import { Toaster } from '@/components/ui/toaster';

import { notoSansTC } from './font';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // Preload the logged-in user's avatar through the next/image optimizer so the
  // profile view / edit page's first paint does not wait on a cold S3 fetch.
  // imageSrcSet + imageSizes lets the browser pick the same width that
  // <Image sizes="150-160px" /> will request (w=256 at 1x DPR, w=384 at 2x),
  // avoiding the cache-miss caused by a fixed-width preload.
  // Skip preload entirely when the avatar URL carries no `?v=` query — the
  // upload pipeline always bakes in a cache buster, so a bare URL means
  // legacy data we'd rather refetch live than cache for 30 days.
  const sessionAvatar = session?.user?.avatar ?? null;
  const avatarSrc =
    sessionAvatar && sessionAvatar.includes('?v=') ? sessionAvatar : null;
  const buildOptimizerUrl = (w: number) =>
    `/_next/image?url=${encodeURIComponent(avatarSrc ?? '')}&w=${w}&q=75`;
  const avatarSrcSet = avatarSrc
    ? `${buildOptimizerUrl(256)} 256w, ${buildOptimizerUrl(384)} 384w`
    : null;

  return (
    <html lang="zh-TW" className={notoSansTC.className}>
      <head>
        {avatarSrcSet && (
          <link
            rel="preload"
            as="image"
            imageSrcSet={avatarSrcSet}
            imageSizes="160px"
            fetchPriority="high"
          />
        )}
      </head>
      <body id="app">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
        <Providers session={session}>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main
              id="main-content"
              tabIndex={-1}
              className="grow pt-[70px] focus:outline-none"
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
