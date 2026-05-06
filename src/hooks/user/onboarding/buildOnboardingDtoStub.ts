import type { MentorProfileVO } from '@/services/profile/user';

export interface OnboardingStubInput {
  name?: string | null;
  avatar?: string | null;
  location?: string | null;
  years_of_experience?: string | null;
  want_position?: string[];
  want_skill?: string[];
  want_topic?: string[];
}

/**
 * Builds a `MentorProfileVO` stub from mentee-onboarding form data so the
 * caller can prime the user-profile cache before navigating to
 * `/profile/card`. ProfileCard only consumes a subset of the DTO on the
 * mentee branch (name / avatar / want_position / want_skill / want_topic),
 * so unused fields are filled with safe defaults that match the API's
 * "empty" shape and keep `parseUserDtoToUserType` happy.
 *
 * The wire format for the want and have buckets is now flat subject_group
 * codes; display labels are resolved downstream against the shared tag
 * catalog, so this stub no longer needs the catalog to hydrate fields itself.
 */
export function buildOnboardingDtoStub({
  userId,
  formData,
  isMentor = false,
}: {
  userId: number;
  formData: OnboardingStubInput;
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
    experiences: [],
    want_position: formData.want_position ?? [],
    want_skill: formData.want_skill ?? [],
    want_topic: formData.want_topic ?? [],
    have_skill: null,
    have_topic: null,
  };
}
