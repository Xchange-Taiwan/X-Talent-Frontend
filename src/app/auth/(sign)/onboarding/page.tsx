import { fetchIndustriesServer } from '@/services/profile/industries.server';
import { fetchTagCatalogServer } from '@/services/profile/tagCatalog.server';

import OnboardingContainer from './container';

export default async function Page() {
  const [initialIndustries, initialTagCatalog] = await Promise.all([
    fetchIndustriesServer('zh_TW'),
    fetchTagCatalogServer('zh_TW'),
  ]);

  return (
    <OnboardingContainer
      initialIndustries={initialIndustries}
      initialTagCatalog={initialTagCatalog}
    />
  );
}
