import type { IndustryOption } from '@/services/profile/tagCatalog';
import type { MentorProfileVO } from '@/services/profile/user';

export interface OnboardingStubInput {
  name?: string | null;
  avatar?: string | null;
  location?: string | null;
  years_of_experience?: string | null;
  // subject_group code from the onboarding industry select
  industry?: string | null;
  want_position?: string[];
  want_skill?: string[];
  want_topic?: string[];
}

// The BFF read response enriches `industry` to a TagVO-shaped object —
// useEditProfileData and useUserData both pull subject_group / subject off
// it. Onboarding submits a flat subject_group string, so we resolve it
// against the catalog the caller already has and stash an enriched object
// in the cache stub. Without this, the freshly-primed cache reports
// industry as null and /profile/edit renders an empty industry field
// despite onboarding having just collected one.
function resolveIndustryStub(
  subjectGroup: string | null | undefined,
  catalog: IndustryOption[]
): MentorProfileVO['industry'] {
  if (!subjectGroup) return null;
  const match = catalog.find((opt) => opt.subject_group === subjectGroup);
  if (!match) return null;
  return {
    subject_group: match.subject_group,
    subject: match.subject,
  } as unknown as MentorProfileVO['industry'];
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
 * catalog, so this stub no longer needs the catalog to hydrate those
 * fields itself. Industry is the exception: the BFF returns it enriched
 * (TagVO-shaped) on read, so the stub resolves the submitted code against
 * the industry catalog so the cached shape matches what edit/profile pages
 * expect.
 */
export function buildOnboardingDtoStub({
  userId,
  formData,
  isMentor = false,
  industryCatalog = [],
}: {
  userId: number;
  formData: OnboardingStubInput;
  isMentor?: boolean;
  industryCatalog?: IndustryOption[];
}): MentorProfileVO {
  return {
    user_id: userId,
    name: formData.name ?? null,
    avatar: formData.avatar ?? null,
    job_title: null,
    company: null,
    years_of_experience: formData.years_of_experience ?? null,
    location: formData.location ?? null,
    industry: resolveIndustryStub(formData.industry, industryCatalog),
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
