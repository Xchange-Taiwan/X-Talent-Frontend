import avatarImage from '@/assets/default-avatar.png';
import { fetchIndustriesServer } from '@/services/profile/industries.server';
import { fetchTagCatalogServer } from '@/services/profile/tagCatalog.server';
import type { MentorType } from '@/services/search-mentor/mentors';
import { fetchMentorsServer } from '@/services/search-mentor/mentors.server';

import { PAGE_LIMIT } from './constants';
import MentorPoolContainer from './container';
import {
  paramsToFetchConditions,
  type ServerSearchParams,
  toURLSearchParams,
} from './searchParams';

function resolveAvatar(mentor: MentorType): MentorType {
  return {
    ...mentor,
    avatar:
      typeof mentor.avatar === 'string' && mentor.avatar
        ? `${mentor.avatar}${mentor.updated_at ? `?cb=${mentor.updated_at}` : ''}`
        : avatarImage,
  };
}

interface Props {
  searchParams: ServerSearchParams;
}

export default async function MentorPoolWithData({ searchParams }: Props) {
  const urlParams = toURLSearchParams(searchParams);
  const conditions = paramsToFetchConditions(urlParams);

  const [mentors, initialIndustries, initialTagCatalog] = await Promise.all([
    fetchMentorsServer({
      ...conditions,
      limit: PAGE_LIMIT,
      cursor: '',
    }),
    fetchIndustriesServer('zh_TW'),
    fetchTagCatalogServer('zh_TW'),
  ]);
  const initialMentors = mentors.map(resolveAvatar);
  const initialCursor = initialMentors.at(-1)?.updated_at?.toString() ?? '';

  return (
    <MentorPoolContainer
      key={urlParams.toString()}
      initialMentors={initialMentors}
      initialCursor={initialCursor}
      initialMentorCount={initialMentors.length}
      initialIndustries={initialIndustries}
      initialTagCatalog={initialTagCatalog}
    />
  );
}
