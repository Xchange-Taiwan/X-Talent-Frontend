import { buildTagLabelMap } from '@/services/profile/tagCatalog';
import { fetchTagCatalogServer } from '@/services/profile/tagCatalog.server';
import { resolveMentor } from '@/services/search-mentor/mapMentor';
import { fetchMentorsServer } from '@/services/search-mentor/mentors.server';

import { PAGE_LIMIT } from './constants';
import MentorPoolContainer from './container';

// Always fetches the unfiltered listing so this route stays ISR-cacheable;
// filtered/search results are fetched client-side by MentorPoolContainer.
export default async function MentorPoolWithData() {
  const [mentors, initialTagCatalog] = await Promise.all([
    fetchMentorsServer({
      search_pattern: '',
      limit: PAGE_LIMIT,
      cursor: '',
    }),
    fetchTagCatalogServer('zh_TW'),
  ]);
  const labelMap = buildTagLabelMap(initialTagCatalog);
  const initialMentors = mentors.map((m) => resolveMentor(m, labelMap));
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
