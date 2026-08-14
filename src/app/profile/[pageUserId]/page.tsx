import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth/next';

import authOptions from '@/auth.config';
import { PersonJsonLd } from '@/components/seo/PersonJsonLd';
import { buildTagLabelMap } from '@/lib/profile/tagLabelMap';
import { buildMentorMetadata } from '@/lib/seo/buildMentorMetadata';
import { sanitizePublicProfile } from '@/lib/seo/sanitizePublicProfile';
import { getSiteUrl } from '@/lib/site-url';
import { fetchTagCatalogServer } from '@/services/profile/tagCatalog.server';
import { fetchUserByIdServer } from '@/services/profile/user.server';

import ProfilePageContainer from './container';

// ISR: each (userId) profile page is cached on the server for 60s. Edit
// submit calls revalidatePath to invalidate on demand.
export const revalidate = 60;

interface PageProps {
  params: { pageUserId: string };
}

const FALLBACK_METADATA: Metadata = {
  title: 'XChange Talent Pool',
  robots: { index: false, follow: false },
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const userIdNum = Number(params.pageUserId);
  if (!Number.isFinite(userIdNum)) return FALLBACK_METADATA;
  const [dto, catalogs] = await Promise.all([
    fetchUserByIdServer(userIdNum, 'zh_TW'),
    fetchTagCatalogServer('zh_TW'),
  ]);
  if (!dto) return FALLBACK_METADATA;
  return buildMentorMetadata(
    sanitizePublicProfile(dto, buildTagLabelMap(catalogs))
  );
}

interface CustomUser {
  id?: string;
}

function hasUserProperties(user: unknown): user is CustomUser {
  return typeof user === 'object' && user !== null && 'id' in user;
}

export default async function Page({ params: { pageUserId } }: PageProps) {
  const userIdNum = Number(pageUserId);
  if (!Number.isFinite(userIdNum)) notFound();

  const [initialDto, session, catalogs] = await Promise.all([
    fetchUserByIdServer(userIdNum, 'zh_TW'),
    getServerSession(authOptions),
    fetchTagCatalogServer('zh_TW'),
  ]);

  if (!initialDto) notFound();

  const user = session?.user;
  const initialLoginUserId =
    hasUserProperties(user) && user.id ? String(user.id) : '';
  const publicProfile = sanitizePublicProfile(
    initialDto,
    buildTagLabelMap(catalogs)
  );
  const siteUrl = getSiteUrl();

  return (
    <>
      <PersonJsonLd profile={publicProfile} siteUrl={siteUrl} />
      <ProfilePageContainer
        pageUserId={pageUserId}
        initialDto={initialDto}
        initialCatalogs={catalogs}
        initialLoginUserId={initialLoginUserId}
      />
    </>
  );
}
