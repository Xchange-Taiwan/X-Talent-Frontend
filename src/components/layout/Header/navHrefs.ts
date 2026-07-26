// Single source of truth for the userId-dependent nav destinations shared by
// Header.tsx and HamburgerMenu.tsx, so the two never drift out of sync.

export function getProfileHref(userId: string | undefined): string {
  return userId ? `/profile/${userId}` : '/';
}

export function getBecomeMentorHref(userId: string | undefined): string {
  return userId
    ? `/profile/${userId}/edit?mentor-onboarding=true`
    : '/auth/signup';
}
