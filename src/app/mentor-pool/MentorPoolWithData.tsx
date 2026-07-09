import { fetchTagCatalogServer } from '@/services/profile/tagCatalog.server';
import { resolveMentorAvatar } from '@/services/search-mentor/mapMentor';
import { fetchMentorsServer } from '@/services/search-mentor/mentors.server';

import { PAGE_LIMIT } from './constants';
import MentorPoolContainer from './container';

// Always fetches the unfiltered listing so this stays cacheable under ISR
// (see `revalidate` in page.tsx). Filtered/search results are fetched
// client-side by MentorPoolContainer once the URL's search params resolve.
export default async function MentorPoolWithData() {
  const [mentors, initialTagCatalog] = await Promise.all([
    fetchMentorsServer({
      search_pattern: '',
      limit: PAGE_LIMIT,
      cursor: '',
    }),
    fetchTagCatalogServer('zh_TW'),
  ]);
  const initialMentors = mentors.map(resolveMentorAvatar);
  const initialCursor = initialMentors.at(-1)?.updated_at?.toString() ?? '';

  return (
    <MentorPoolContainer
      initialMentors={initialMentors}
      initialCursor={initialCursor}
      initialMentorCount={initialMentors.length}
      initialTagCatalog={initialTagCatalog}
    />
  );
}
