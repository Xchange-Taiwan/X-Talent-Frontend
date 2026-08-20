import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';

import authOptions from '@/auth.config';
import { hasUserProperties, isValidUserId } from '@/lib/auth/userGuard';
import { DEFAULT_LOGIN } from '@/routes';
import { EMPTY_TAG_CATALOGS } from '@/services/profile/tagCatalog';
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
  // errors internally and resolve to null/EMPTY_TAG_CATALOGS - these .catch
  // handlers are defense-in-depth against an unexpected throw so a transient
  // SSR failure degrades to the client-side fallback fetch in the container
  // instead of taking down the whole page render.
  const [initialDto, initialCatalogs] = await Promise.all([
    fetchUserByIdServer(loginUserId, 'zh_TW').catch(() => null),
    fetchTagCatalogServer('zh_TW').catch(() => EMPTY_TAG_CATALOGS),
  ]);

  return (
    <ProfileCardContainer
      loginUserId={loginUserId}
      initialDto={initialDto}
      initialCatalogs={initialCatalogs}
    />
  );
}
