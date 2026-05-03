import type { TagCatalogGroupVO } from '@/services/profile/tagCatalog';
import type { MentorProfileVO } from '@/services/profile/user';
import type { components } from '@/types/api';

type TagVO = components['schemas']['TagVO'];

export interface TagPools {
  want_position: TagCatalogGroupVO[];
  want_skill: TagCatalogGroupVO[];
  want_topic: TagCatalogGroupVO[];
}

export interface OnboardingStubInput {
  name?: string | null;
  avatar?: string | null;
  location?: string | null;
  years_of_experience?: string | null;
  want_position?: string[];
  want_skill?: string[];
  want_topic?: string[];
}

function buildLeafLookup(groups: TagCatalogGroupVO[]): Map<string, TagVO> {
  const lookup = new Map<string, TagVO>();
  for (const group of groups) {
    for (const leaf of group.leaves) {
      lookup.set(leaf.subject_group, {
        id: leaf.tag_id,
        kind: '',
        subject_group: leaf.subject_group,
        language: leaf.language,
        subject: leaf.subject,
      });
    }
  }
  return lookup;
}

function hydrate(
  ids: string[] | undefined,
  groups: TagCatalogGroupVO[]
): TagVO[] {
  if (!ids?.length) return [];
  const lookup = buildLeafLookup(groups);
  return ids.map((id) => {
    const match = lookup.get(id);
    if (match) return match;
    // Lookup miss fallback: surface the raw ID so the next page does not
    // silently drop a chip the user just selected.
    return {
      id: 0,
      kind: '',
      subject_group: id,
      subject: id,
    };
  });
}

/**
 * Builds a `MentorProfileVO` stub from mentee-onboarding form data so the
 * caller can prime the user-profile cache before navigating to
 * `/profile/card`. ProfileCard only consumes a subset of the DTO on the
 * mentee branch (name / avatar / want_position / want_skill / want_topic),
 * so unused fields are filled with safe defaults that match the API's
 * "empty" shape and keep `parseUserDtoToUserType` happy.
 */
export function buildOnboardingDtoStub({
  userId,
  formData,
  pools,
  isMentor = false,
}: {
  userId: number;
  formData: OnboardingStubInput;
  pools: TagPools;
  isMentor?: boolean;
}): MentorProfileVO {
  return {
    user_id: userId,
    name: formData.name ?? null,
    avatar: formData.avatar ?? null,
    job_title: null,
    company: null,
    years_of_experience: formData.years_of_experience ?? null,
    location: formData.location ?? null,
    industry: null,
    onboarding: true,
    is_mentor: isMentor,
    language: 'zh_TW',
    personal_statement: null,
    about: null,
    seniority_level: null,
    expertises: null,
    experiences: [],
    want_position: hydrate(formData.want_position, pools.want_position),
    want_skill: hydrate(formData.want_skill, pools.want_skill),
    want_topic: hydrate(formData.want_topic, pools.want_topic),
    have_skill: null,
    have_topic: null,
  };
}
