import { Header } from '@/components/Layout/Header';

export default function LandingPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className=" overflow-auto ">
      <Header />
      <main className="pt-[70px]">{children}</main>
    </div>
  );
}
