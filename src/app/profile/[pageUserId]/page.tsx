import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

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
  params: Promise<{ pageUserId: string }>;
}

const FALLBACK_METADATA: Metadata = {
  title: 'XChange Talent Pool',
  robots: { index: false, follow: false },
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { pageUserId } = await params;
  const userIdNum = Number(pageUserId);
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

export default async function Page({ params }: PageProps) {
  const { pageUserId } = await params;
  const userIdNum = Number(pageUserId);
  if (!Number.isFinite(userIdNum)) notFound();

  const [initialDto, catalogs] = await Promise.all([
    fetchUserByIdServer(userIdNum, 'zh_TW'),
    fetchTagCatalogServer('zh_TW'),
  ]);

  if (!initialDto) notFound();

  // Login state is resolved client-side only (see ProfilePageContainer's
  // useSession()). Dropping the SSR getServerSession() call here lets this
  // route stay ISR-cacheable (`revalidate = 60` below) instead of being
  // forced into per-request dynamic rendering just to read the auth cookie -
  // the cost was every navigation re-fetching from the backend with no
  // caching. Trade-off: the edit button / own-profile UI can flash in a
  // frame after hydration instead of being present on first paint.
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
        initialLoginUserId=""
      />
    </>
  );
}
