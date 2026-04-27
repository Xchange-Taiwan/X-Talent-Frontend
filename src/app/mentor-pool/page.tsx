import { Suspense } from 'react';

import MentorGridSkeleton from './MentorGridSkeleton';
import MentorPoolHero from './MentorPoolHero';
import MentorPoolSearchBar from './MentorPoolSearchBar';
import { MentorPoolStateProvider } from './MentorPoolStateProvider';
import MentorPoolWithData from './MentorPoolWithData';

export default function Page() {
  return (
    <MentorPoolStateProvider>
      <div className="relative">
        <MentorPoolHero />
        <MentorPoolSearchBar />
      </div>
      <Suspense fallback={<MentorGridSkeleton />}>
        <MentorPoolWithData />
      </Suspense>
    </MentorPoolStateProvider>
  );
}
