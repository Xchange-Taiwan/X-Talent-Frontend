import type { Metadata } from 'next';
import { Suspense } from 'react';

import MentorGridSkeleton from './MentorGridSkeleton';
import MentorPoolHero from './MentorPoolHero';
import MentorPoolSearchBar from './MentorPoolSearchBar';
import MentorPoolWithData from './MentorPoolWithData';

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

// The page no longer reads `searchParams`, so Next.js can serve this ISR
// snapshot from the CDN instead of invoking the function per request.
// Filtered/search results are fetched client-side (see MentorPoolContainer);
// profile edits purge this via revalidatePath('/mentor-pool').
export const revalidate = 600;

export default function Page() {
  return (
    <>
      <div className="relative">
        <MentorPoolHero />
        <Suspense fallback={null}>
          <MentorPoolSearchBar />
        </Suspense>
      </div>
      <Suspense fallback={<MentorGridSkeleton />}>
        <MentorPoolWithData />
      </Suspense>
    </>
  );
}
