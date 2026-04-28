import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth/next';

import authOptions from '@/auth.config';
import { fetchUserByIdServer } from '@/services/profile/user.server';

import ProfilePageContainer from './container';

// ISR: each (userId) profile page is cached on the server for 60s. Edit
// submit calls revalidatePath to invalidate on demand.
export const revalidate = 60;

interface PageProps {
  params: { pageUserId: string };
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const userIdNum = Number(params.pageUserId);
  if (!Number.isFinite(userIdNum)) return {};
  const dto = await fetchUserByIdServer(userIdNum, 'zh_TW');
  if (!dto) return {};
  const name = dto.name ?? 'Profile';
  const about = dto.about ? truncate(dto.about, 160) : undefined;
  return {
    title: name,
    description: about,
    openGraph: {
      title: name,
      description: about,
      images: dto.avatar ? [{ url: dto.avatar }] : undefined,
    },
  };
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

  // Cache-bust the avatar URL per ISR render so the Image Optimizer treats
  // each revalidation cycle as a new entry. Edit submit calls revalidatePath
  // → next render generates a fresh value → optimizer re-fetches from S3.
  // Stopgap until the backend exposes an `avatar_updated_at` we can use as a
  // precise version.
  const initialAvatarVersion = Date.now();

  return (
    <ProfilePageContainer
      pageUserId={pageUserId}
      initialDto={initialDto}
      initialLoginUserId={initialLoginUserId}
      initialAvatarVersion={initialAvatarVersion}
    />
  );
}
