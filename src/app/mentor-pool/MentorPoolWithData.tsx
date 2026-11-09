import { unstable_noStore } from 'next/cache';

import { fetchTagCatalogServer } from '@/services/profile/tagCatalog.server';
import { fetchMentorsServer } from '@/services/search-mentor/mentors.server';
import { asMentorPage } from '@/types/mentor';

import { PAGE_LIMIT } from './constants';
import MentorPoolContainer from './container';

// Always fetches the unfiltered listing so this route stays ISR-cacheable;
// filtered/search results are fetched client-side by MentorPoolContainer.
export default async function MentorPoolWithData() {
  let initialError = false;
  const [initialMentorPageResult, initialTagCatalog] = await Promise.all([
    fetchMentorsServer({
      search_pattern: '',
      limit: PAGE_LIMIT,
    }).catch((err: unknown) => {
      console.error(
        'SSR fetchMentors error captured:',
        err instanceof Error ? err.message : String(err)
      );
      // Opt-out of static/ISR caching for this failed run to preserve healthy cache
      unstable_noStore();
      initialError = true;
      return { mentors: [], nextCursor: null };
    }),
    fetchTagCatalogServer('zh_TW'),
  ]);
  const initialMentorPage = asMentorPage(initialMentorPageResult);

  return (
    <MentorPoolContainer
      initialMentors={initialMentorPage.mentors}
      initialNextCursor={initialMentorPage.nextCursor}
      initialMentorCount={initialMentorPage.mentors.length}
      initialTagCatalog={initialTagCatalog}
      initialError={initialError}
    />
  );
}
