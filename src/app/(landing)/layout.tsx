import { Footer } from '@/components/Layout/Footer';
import { Header } from '@/components/Layout/Header';

export default function LandingPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Header />
      <main className="grow">{children}</main>
      <Footer />
    </div>
  );
}
