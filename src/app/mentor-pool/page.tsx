import type { Metadata } from 'next';
import { Suspense } from 'react';

import MentorGridSkeleton from './MentorGridSkeleton';
import MentorPoolHero from './MentorPoolHero';
import MentorPoolSearchBar from './MentorPoolSearchBar';
import MentorPoolWithData from './MentorPoolWithData';
import type { ServerSearchParams } from './searchParams';

// canonical points to the bare path so search engines collapse all
// `?keyword=...` / filter variants onto a single indexable URL.
export const metadata: Metadata = {
  title: '尋找導師',
  description:
    '瀏覽 XChange Talent Pool 上的業界導師，依領域、職能、年資搜尋並預約 1:1 會談。',
  alternates: { canonical: '/mentor-pool' },
  openGraph: {
    title: '尋找導師',
    description:
      '瀏覽 XChange Talent Pool 上的業界導師，依領域、職能、年資搜尋並預約 1:1 會談。',
    url: '/mentor-pool',
  },
};

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
