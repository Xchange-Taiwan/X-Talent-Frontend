import { fetchTagCatalogServer } from '@/services/profile/tagCatalog.server';
import { fetchMentorsServer } from '@/services/search-mentor/mentors.server';

import { PAGE_LIMIT } from './constants';
import MentorPoolContainer from './container';

// Always fetches the unfiltered listing so this route stays ISR-cacheable;
// filtered/search results are fetched client-side by MentorPoolContainer.
export default async function MentorPoolWithData() {
  let initialError = false;
  const [initialMentors, initialTagCatalog] = await Promise.all([
    fetchMentorsServer({
      search_pattern: '',
      limit: PAGE_LIMIT,
      cursor: '',
    }).catch((err) => {
      console.error('SSR fetchMentors error captured:', err);
      initialError = true;
      return [];
    }),
    fetchTagCatalogServer('zh_TW'),
  ]);

  return (
    <MentorPoolContainer
      initialMentors={initialMentors}
      initialMentorCount={initialMentors.length}
      initialTagCatalog={initialTagCatalog}
      initialError={initialError}
    />
  );
}
