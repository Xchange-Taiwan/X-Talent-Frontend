import { fetchIndustriesServer } from '@/services/profile/industries.server';
import { fetchInterestsServer } from '@/services/profile/interests.server';

import OnboardingContainer from './container';

export default async function Page() {
  const [initialIndustries, initialInterests] = await Promise.all([
    fetchIndustriesServer('zh_TW'),
    fetchInterestsServer('zh_TW'),
  ]);

  return (
    <OnboardingContainer
      initialIndustries={initialIndustries}
      initialInterests={initialInterests}
    />
  );
}
