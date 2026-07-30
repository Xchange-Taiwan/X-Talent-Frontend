import { fetchTagCatalogServer } from '@/services/profile/tagCatalog.server';

import EditProfileContainer from './container';

export default async function Page({
  params,
}: {
  params: { pageUserId: string };
}) {
  const initialTagCatalog = await fetchTagCatalogServer('zh_TW');

  return (
    <EditProfileContainer
      pageUserId={params.pageUserId}
      initialTagCatalog={initialTagCatalog}
    />
  );
}
