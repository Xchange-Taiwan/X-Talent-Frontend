export const FIND_MENTOR_HREF = '/mentor-pool';
export const SIGNUP_HREF = '/auth/signup';
export const MENTOR_ONBOARDING_KEY = 'mentor-onboarding';
export const OPEN_SCHEDULE_DIALOG_KEY = 'open-schedule';

export function getProfileEditUrl(userId: string | number): string {
  return `/profile/${userId}/edit`;
}

export function getMentorOnboardingUrl(userId: string | number): string {
  return `${getProfileEditUrl(userId)}?${MENTOR_ONBOARDING_KEY}=true`;
}

export function getBecomeMentorHref(userId: string | undefined): string {
  return userId ? getMentorOnboardingUrl(userId) : SIGNUP_HREF;
}

export function getMentorScheduleManagementUrl(
  userId: string | number
): string {
  return `/profile/${userId}?${OPEN_SCHEDULE_DIALOG_KEY}=true`;
}

export function getOpenScheduleHref(userId: string | undefined): string {
  return userId ? getMentorScheduleManagementUrl(userId) : '/';
}
