import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';

import CoverImgUrl from '@/assets/auth/signIn-cover.webp';
import authOptions from '@/auth.config';

export default async function AuthOperationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  // Redirect logged-in users away from signin/signup, but let users with
  // incomplete onboarding (onBoarding === false) through to /auth/onboarding.
  if (session?.user?.id && session.user.onBoarding !== false) redirect('/');

  return (
    <div className="flex lg:min-h-screen">
      <div className="flex-1 basis-1/2">{children}</div>
      <div
        className="box-border hidden flex-1 basis-1/2 flex-col items-center justify-center bg-cover bg-center bg-no-repeat px-8 py-16 text-center lg:sticky lg:top-0 lg:flex lg:h-screen lg:self-start xl:px-20 xl:py-32"
        style={{ backgroundImage: `url(${CoverImgUrl.src})` }}
      >
        <div className="flex max-w-md flex-col gap-6 text-text-white xl:gap-8">
          <p className="text-2xl font-bold lg:text-3xl xl:text-4xl">
            現在就加入，更加豐富你的職涯！
          </p>
          <p className="text-base">
            加入我們，成為 X-Talent
            的一份子。一起拓展人脈、提升事業，還有機會接觸到各種資源和機會！
          </p>
        </div>
      </div>
    </div>
  );
}
