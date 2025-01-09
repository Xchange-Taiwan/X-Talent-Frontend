import CoverImgUrl from '@/assets/auth/signIn-cover.png';

export default function AuthOperationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-70px)] lg:min-h-[720px]">
      <div className="flex-1 basis-1/2">{children}</div>
      <div
        className="box-border hidden flex-1	basis-1/2 bg-cover bg-center bg-no-repeat px-20 py-32 text-center lg:block"
        style={{ backgroundImage: `url(${CoverImgUrl.src})` }}
      >
        <div className="flex flex-col gap-8 text-text-white">
          <p className="text-4xl font-bold">現在就加入，更加豐富你的職涯！</p>
          <p className="text-base">
            加入我們，成為 X-Talent
            的一份子。一起拓展人脈、提升事業，還有機會接觸到各種資源和機會！
          </p>
        </div>
      </div>
    </div>
  );
}
