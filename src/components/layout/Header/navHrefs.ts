// Single source of truth for the userId-dependent nav destinations shared by
// Header.tsx and HamburgerMenu.tsx, so the two never drift out of sync.

import { getMentorOnboardingUrl } from '@/lib/routes';

export function getProfileHref(userId: string | undefined): string {
  return userId ? `/profile/${userId}` : '/';
}

export function getBecomeMentorHref(userId: string | undefined): string {
  return userId ? getMentorOnboardingUrl(userId) : '/auth/signup';
}
