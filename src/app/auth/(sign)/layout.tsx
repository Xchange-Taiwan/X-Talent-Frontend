import CoverImgUrl from '@/assets/auth/signIn-cover.png';

export default function AuthOperationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100vh-70px)] lg:min-h-[720px]">
      <div className="flex-1 basis-1/2">{children}</div>
      <div
        className="box-border hidden flex-1	basis-1/2 bg-cover bg-center bg-no-repeat px-20 py-32 text-center lg:block"
        style={{ backgroundImage: `url(${CoverImgUrl.src})` }}
      >
        <div className="flex flex-col gap-8 text-text-white">
          <p className="text-4xl font-bold">Join Now to Enhance Your Career</p>
          <p className="text-base">
            Become part of our talented community. By joining us, you&apos;ll
            enhance your career, expand your network, and access various
            resources and opportunities.
          </p>
        </div>
      </div>
    </div>
  );
}
