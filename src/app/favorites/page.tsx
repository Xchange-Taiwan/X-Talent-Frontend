import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { isFavoritesEnabled } from '@/lib/featureFlags';
import { FIND_MENTOR_HREF } from '@/lib/routes';
import { buildPrivatePageMetadata } from '@/lib/seo/buildPrivatePageMetadata';

import FavoritesPageContainer from './container';

export const metadata: Metadata = buildPrivatePageMetadata('我的收藏');

export default function FavoritesPage() {
  if (!isFavoritesEnabled()) {
    redirect(FIND_MENTOR_HREF);
  }

  return <FavoritesPageContainer />;
}
