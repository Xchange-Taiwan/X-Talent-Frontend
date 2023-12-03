import '../styles/global.css';

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
        {children}
        <Toaster />
      </body>
    </html>
  );
}
