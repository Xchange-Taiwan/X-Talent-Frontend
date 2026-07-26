export const MENTOR_ONBOARDING_KEY = 'mentor-onboarding';

export function getProfileEditUrl(userId: string | number): string {
  return `/profile/${userId}/edit`;
}

export function getMentorOnboardingUrl(userId: string | number): string {
  return `/profile/${userId}/edit?${MENTOR_ONBOARDING_KEY}=true`;
}
