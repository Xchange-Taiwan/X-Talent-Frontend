import avatarImage from '@/assets/default-avatar.png';
import type { MentorType } from '@/services/search-mentor/mentors';
import { fetchMentorsEnrichedServer } from '@/services/search-mentor/mentors.server';

import { PAGE_LIMIT } from './constants';
import MentorPoolContainer from './container';

function resolveAvatar(mentor: MentorType): MentorType {
  return {
    ...mentor,
    avatar:
      typeof mentor.avatar === 'string' && mentor.avatar
        ? `${mentor.avatar}${mentor.updated_at ? `?cb=${mentor.updated_at}` : ''}`
        : avatarImage,
  };
}

export default async function MentorPoolWithData() {
  const initialMentors = (
    await fetchMentorsEnrichedServer({ limit: PAGE_LIMIT, cursor: '' })
  ).map(resolveAvatar);
  const initialCursor = initialMentors.at(-1)?.updated_at?.toString() ?? '';

  return (
    <MentorPoolContainer
      initialMentors={initialMentors}
      initialCursor={initialCursor}
      initialMentorCount={initialMentors.length}
    />
  );
}
