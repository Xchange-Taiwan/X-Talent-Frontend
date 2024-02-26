import '../styles/global.css';

import { Footer } from '@/components/Layout/Footer';
import { Header } from '@/components/Layout/Header';
import { Toaster } from '@/components/ui/toaster';

import { notoSans } from './font';
export const metadata = {
  title: {
    default: 'XChange Talent Pool',
    template: '%s | XChange Talent Pool',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" className={notoSans.className}>
      <body id="app">
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="grow pt-[70px]">{children}</main>
          <Footer />
        </div>
        <Toaster />
      </body>
    </html>
  );
}
