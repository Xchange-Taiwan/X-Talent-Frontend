import type { OnboardingFormContext } from '@/hooks/user/onboarding/useOnboardingForm';
import type { ProfileFormContext } from '@/hooks/user/profile/useProfileEditorSession';
import type { OnboardingFormValues } from '@/schemas/onboarding';
import type { ProfileFormValues } from '@/schemas/profileSchema';

type VerifyBidirectionalField<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : never
  : never;

type VerifySharedSectionCompatibility = VerifyBidirectionalField<
  NonNullable<OnboardingFormValues['links']>,
  ProfileFormValues['links']
> &
  VerifyBidirectionalField<
    NonNullable<OnboardingFormValues['work_experiences']>,
    ProfileFormValues['work_experiences']
  > &
  VerifyBidirectionalField<
    NonNullable<OnboardingFormValues['educations']>,
    ProfileFormValues['educations']
  > &
  VerifyBidirectionalField<
    Pick<OnboardingFormValues, 'want_position' | 'want_skill' | 'want_topic'>,
    Pick<ProfileFormValues, 'want_position' | 'want_skill' | 'want_topic'>
  >;

export type SharedProfileEditorForm =
  VerifySharedSectionCompatibility extends true
    ? ProfileFormContext | OnboardingFormContext
    : never;

export function asProfileFormContext(
  form: SharedProfileEditorForm
): ProfileFormContext {
  return form as ProfileFormContext;
}
