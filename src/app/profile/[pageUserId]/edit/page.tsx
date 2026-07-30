import dynamic from 'next/dynamic';

import { PageLoading } from '@/components/ui/loading-spinner';
import { fetchTagCatalogServer } from '@/services/profile/tagCatalog.server';

const EditProfileContainer = dynamic(() => import('./container'), {
  ssr: false,
  loading: () => <PageLoading />,
});

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
