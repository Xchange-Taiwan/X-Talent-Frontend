import { fetchIndustriesServer } from '@/services/profile/industries.server';
import { fetchTagCatalogServer } from '@/services/profile/tagCatalog.server';

import EditProfileContainer from './container';

export default async function Page({
  params,
}: {
  params: { pageUserId: string };
}) {
  const [initialIndustries, initialTagCatalog] = await Promise.all([
    fetchIndustriesServer('zh_TW'),
    fetchTagCatalogServer('zh_TW'),
  ]);

  return (
    <EditProfileContainer
      pageUserId={params.pageUserId}
      initialIndustries={initialIndustries}
      initialTagCatalog={initialTagCatalog}
    />
  );
}
