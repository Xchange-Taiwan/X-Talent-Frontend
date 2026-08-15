import { fetchTagCatalogServer } from '@/services/profile/tagCatalog.server';

import EditProfileContainer from './container';

export default async function Page({
  params,
}: {
  params: Promise<{ pageUserId: string }>;
}) {
  const { pageUserId } = await params;
  const initialTagCatalog = await fetchTagCatalogServer('zh_TW');

  return (
    <EditProfileContainer
      pageUserId={pageUserId}
      initialTagCatalog={initialTagCatalog}
    />
  );
}
