import '../styles/global.css';

import { Footer } from '@/components/Layout/Footer';
import { Header } from '@/components/Layout/Header';

import { notoSans } from './font';
import Provider from './provider';

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
        <Provider>
          <div className="flex min-h-screen flex-col overflow-x-hidden">
            <Header />
            <main className="grow">{children}</main>
            <Footer />
          </div>
        </Provider>
      </body>
    </html>
  );
}
