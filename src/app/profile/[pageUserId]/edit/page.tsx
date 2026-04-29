import { fetchExpertisesServer } from '@/services/profile/expertises.server';
import { fetchIndustriesServer } from '@/services/profile/industries.server';
import { fetchInterestsServer } from '@/services/profile/interests.server';

import EditProfileContainer from './container';

export default async function Page({
  params,
}: {
  params: { pageUserId: string };
}) {
  const [initialIndustries, initialInterests, initialExpertises] =
    await Promise.all([
      fetchIndustriesServer('zh_TW'),
      fetchInterestsServer('zh_TW'),
      fetchExpertisesServer('zh_TW'),
    ]);

  return (
    <EditProfileContainer
      pageUserId={params.pageUserId}
      initialIndustries={initialIndustries}
      initialInterests={initialInterests}
      initialExpertises={initialExpertises}
    />
  );
}
