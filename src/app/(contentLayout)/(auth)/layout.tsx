import CoverImgUrl from '@/assets/auth/signIn-cover.png';

export default function AuthOperationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <div
        className="hidden flex-1 bg-cover bg-center bg-no-repeat lg:block"
        style={{ backgroundImage: `url(${CoverImgUrl.src})` }}
      />
      <div className="flex-1">{children}</div>
    </div>
  );
}
