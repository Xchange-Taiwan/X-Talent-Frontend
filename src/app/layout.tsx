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

import { notoSans } from './font';

export function generateMetadata(): Metadata {
  return {
    title: {
      default: 'XChange Talent Pool',
      template: '%s | XChange Talent Pool',
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

  return (
    <html lang="zh-TW" className={notoSans.className}>
      <body id="app">
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
            <main className="grow pt-[70px]">{children}</main>
            <Footer />
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
