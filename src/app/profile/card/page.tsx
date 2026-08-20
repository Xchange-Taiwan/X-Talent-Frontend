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
  // fetchUserByIdServer/fetchTagCatalogServer already catch their own network
  // errors internally, but these .catch handlers are defense-in-depth against
  // an unexpected throw. Both resolve to null (not an "empty but valid" DTO/
  // catalog sentinel) on failure so the container's null-guarded priming
  // skips writing the cache and the client-side fallback fetch in
  // useUserData/useTagCatalog actually gets a chance to run, instead of the
  // cache being primed with a value that looks like a successful empty fetch.
  const [initialDto, initialCatalogs] = await Promise.all([
    fetchUserByIdServer(loginUserId, 'zh_TW').catch(() => null),
    fetchTagCatalogServer('zh_TW').catch(() => null),
  ]);

  return (
    <ProfileCardContainer
      loginUserId={loginUserId}
      initialDto={initialDto}
      initialCatalogs={initialCatalogs}
    />
  );
}
