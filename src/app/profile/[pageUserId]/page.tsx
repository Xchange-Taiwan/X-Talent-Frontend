import type { Metadata } from 'next';

import { PersonJsonLd } from '@/components/seo/PersonJsonLd';
import { buildMentorMetadata } from '@/lib/seo/buildMentorMetadata';
import {
  type PublicMentorProfile,
  sanitizePublicProfile,
} from '@/lib/seo/sanitizePublicProfile';
import { fetchUserByIdServer } from '@/services/profile/userServer';

import ProfilePageContainer from './container';

const PROFILE_LANGUAGE = 'zh_TW';

const FALLBACK_METADATA: Metadata = {
  title: 'XChange Talent Pool',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: { pageUserId: string };
}

async function fetchPublicProfile(
  pageUserId: string
): Promise<PublicMentorProfile | null> {
  const userId = Number(pageUserId);
  if (!Number.isFinite(userId) || userId <= 0) return null;
  const profile = await fetchUserByIdServer(userId, PROFILE_LANGUAGE);
  return profile ? sanitizePublicProfile(profile) : null;
}

export async function generateMetadata({
  params: { pageUserId },
}: PageProps): Promise<Metadata> {
  const publicProfile = await fetchPublicProfile(pageUserId);
  if (!publicProfile) return FALLBACK_METADATA;
  return buildMentorMetadata(publicProfile);
}

export default async function Page({ params: { pageUserId } }: PageProps) {
  const publicProfile = await fetchPublicProfile(pageUserId);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  return (
    <>
      {publicProfile && (
        <PersonJsonLd profile={publicProfile} siteUrl={siteUrl} />
      )}
      <ProfilePageContainer pageUserId={pageUserId} />
    </>
  );
}
