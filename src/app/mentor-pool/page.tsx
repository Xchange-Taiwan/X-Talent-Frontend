import { Suspense } from 'react';

import MentorGridSkeleton from './MentorGridSkeleton';
import MentorPoolHero from './MentorPoolHero';
import MentorPoolSearchBar from './MentorPoolSearchBar';
import MentorPoolWithData from './MentorPoolWithData';
import type { ServerSearchParams } from './searchParams';

interface PageProps {
  searchParams: ServerSearchParams;
}

export default function Page({ searchParams }: PageProps) {
  return (
    <>
      <div className="relative">
        <MentorPoolHero />
        <Suspense fallback={null}>
          <MentorPoolSearchBar />
        </Suspense>
      </div>
      <Suspense fallback={<MentorGridSkeleton />}>
        <MentorPoolWithData searchParams={searchParams} />
      </Suspense>
    </>
  );
}
