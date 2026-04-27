import { type InterestVO } from '@/services/profile/interests';
import { type MentorProfileVO } from '@/services/profile/user';

export interface InterestPools {
  interestedPositions: InterestVO[];
  skills: InterestVO[];
  topics: InterestVO[];
}

export interface OnboardingStubInput {
  name?: string | null;
  avatar?: string | null;
  location?: string | null;
  years_of_experience?: string | null;
  interested_positions?: string[];
  skills?: string[];
  topics?: string[];
}

function hydrate(ids: string[] | undefined, pool: InterestVO[]): InterestVO[] {
  return (ids ?? []).map((id) => {
    const match = pool.find((vo) => vo.subject_group === id);
    if (match) return match;
    // Lookup miss fallback: surface the raw ID so the next page does not
    // silently drop a chip the user just selected. The shape mirrors
    // InterestVO so downstream parsing (parseUserDtoToUserType) keeps
    // working without a special branch.
    return { id: 0, subject_group: id, subject: id };
  });
}

/**
 * Builds a `MentorProfileVO` stub from mentee-onboarding form data so the
 * caller can prime the user-profile cache before navigating to
 * `/profile/card`. ProfileCard only consumes a subset of the DTO on the
 * mentee branch (name / avatar / interested_positions / skills / topics),
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
  pools: InterestPools;
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
    interested_positions: {
      interests: hydrate(
        formData.interested_positions,
        pools.interestedPositions
      ),
      language: 'zh_TW',
    },
    skills: {
      interests: hydrate(formData.skills, pools.skills),
      language: 'zh_TW',
    },
    topics: {
      interests: hydrate(formData.topics, pools.topics),
      language: 'zh_TW',
    },
    industry: null,
    onboarding: true,
    is_mentor: isMentor,
    language: 'zh_TW',
    personal_statement: null,
    about: null,
    seniority_level: null,
    expertises: null,
    experiences: [],
  };
}
