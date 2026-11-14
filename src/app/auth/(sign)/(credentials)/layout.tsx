import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';

import authOptions from '@/auth.config';
import { hasUserProperties } from '@/lib/auth/userGuard';
import { resolveAuthSurfaceRedirect } from '@/lib/routes';

export default async function AuthCredentialsGuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const redirectTarget = resolveAuthSurfaceRedirect(
    'credentials',
    hasUserProperties(user) ? user : null
  );
  if (redirectTarget) {
    redirect(redirectTarget);
  }

  return <>{children}</>;
}
