import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';

import authOptions from '@/auth.config';
import { hasUserProperties, isValidUserId } from '@/lib/auth/userGuard';
import { DEFAULT_LOGIN } from '@/routes';
import { fetchTagCatalogServer } from '@/services/profile/tagCatalog.server';
import { fetchUserByIdServer } from '@/services/profile/user.server';

import ProfileCardContainer from './container';

// Middleware already redirects unauthenticated requests to this (non-public)
// route before this component runs - the guard below is belt-and-suspenders,
// not the primary auth gate.
export default async function Page() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;
  if (!hasUserProperties(sessionUser) || !isValidUserId(sessionUser.id)) {
    redirect(DEFAULT_LOGIN);
  }

  const loginUserId = Number(sessionUser.id);
  const [initialDto, initialCatalogs] = await Promise.all([
    fetchUserByIdServer(loginUserId, 'zh_TW'),
    fetchTagCatalogServer('zh_TW'),
  ]);

  return (
    <ProfileCardContainer
      loginUserId={loginUserId}
      initialDto={initialDto}
      initialCatalogs={initialCatalogs}
    />
  );
}
