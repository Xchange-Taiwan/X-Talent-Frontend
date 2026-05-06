import { fetchTagCatalogServer } from '@/services/profile/tagCatalog.server';

import OnboardingContainer from './container';

export default async function Page() {
  const initialTagCatalog = await fetchTagCatalogServer('zh_TW');

  return <OnboardingContainer initialTagCatalog={initialTagCatalog} />;
}
