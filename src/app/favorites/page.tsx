import type { Metadata } from 'next';

import { buildPrivatePageMetadata } from '@/lib/seo/buildPrivatePageMetadata';

import FavoritesPageContainer from './container';

export const metadata: Metadata = buildPrivatePageMetadata('我的收藏');

export default function FavoritesPage() {
  return <FavoritesPageContainer />;
}
