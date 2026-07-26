import { describe, expect, it } from 'vitest';

import {
  getMentorOnboardingUrl,
  getProfileEditUrl,
  MENTOR_ONBOARDING_KEY,
} from './routes';

describe('routes helpers', () => {
  it('defines MENTOR_ONBOARDING_KEY correctly', () => {
    expect(MENTOR_ONBOARDING_KEY).toBe('mentor-onboarding');
  });

  describe('getProfileEditUrl', () => {
    it('returns the correct profile edit path', () => {
      expect(getProfileEditUrl(123)).toBe('/profile/123/edit');
      expect(getProfileEditUrl('abc')).toBe('/profile/abc/edit');
    });
  });

  describe('getMentorOnboardingUrl', () => {
    it('returns the correct mentor onboarding path', () => {
      expect(getMentorOnboardingUrl(123)).toBe(
        '/profile/123/edit?mentor-onboarding=true'
      );
      expect(getMentorOnboardingUrl('abc')).toBe(
        '/profile/abc/edit?mentor-onboarding=true'
      );
    });
  });
});
