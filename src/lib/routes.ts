export const MENTOR_ONBOARDING_KEY = 'mentor-onboarding';
export const OPEN_SCHEDULE_DIALOG_KEY = 'open-schedule';

export function getProfileEditUrl(userId: string | number): string {
  return `/profile/${userId}/edit`;
}

export function getMentorOnboardingUrl(userId: string | number): string {
  return `${getProfileEditUrl(userId)}?${MENTOR_ONBOARDING_KEY}=true`;
}

export function getMentorScheduleManagementUrl(
  userId: string | number
): string {
  return `/profile/${userId}?${OPEN_SCHEDULE_DIALOG_KEY}=true`;
}
