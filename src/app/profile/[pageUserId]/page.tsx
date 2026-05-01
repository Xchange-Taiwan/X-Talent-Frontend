import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth/next';

import authOptions from '@/auth.config';
import { PersonJsonLd } from '@/components/seo/PersonJsonLd';
import { buildMentorMetadata } from '@/lib/seo/buildMentorMetadata';
import { sanitizePublicProfile } from '@/lib/seo/sanitizePublicProfile';
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
  const dto = await fetchUserByIdServer(userIdNum, 'zh_TW');
  if (!dto) return FALLBACK_METADATA;
  return buildMentorMetadata(sanitizePublicProfile(dto));
}

export default async function Page({ params: { pageUserId } }: PageProps) {
  const userIdNum = Number(pageUserId);
  if (!Number.isFinite(userIdNum)) notFound();

  const [initialDto, session] = await Promise.all([
    fetchUserByIdServer(userIdNum, 'zh_TW'),
    getServerSession(authOptions),
  ]);

  if (!initialDto) notFound();

  const initialLoginUserId = session?.user?.id ? String(session.user.id) : '';
  const publicProfile = sanitizePublicProfile(initialDto);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  return (
    <>
      <PersonJsonLd profile={publicProfile} siteUrl={siteUrl} />
      <ProfilePageContainer
        pageUserId={pageUserId}
        initialDto={initialDto}
        initialLoginUserId={initialLoginUserId}
      />
    </>
  );
}
