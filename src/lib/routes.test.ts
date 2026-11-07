import { describe, expect, it } from 'vitest';

import {
  getBecomeMentorHref,
  getMentorOnboardingUrl,
  getMentorScheduleManagementUrl,
  getOpenScheduleHref,
  getProfileEditUrl,
  MENTOR_ONBOARDING_KEY,
  OPEN_SCHEDULE_DIALOG_KEY,
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

  it('builds mentor onboarding and schedule hrefs (#709)', () => {
    expect(OPEN_SCHEDULE_DIALOG_KEY).toBe('open-schedule');
    expect(getBecomeMentorHref('u1')).toBe(
      '/profile/u1/edit?mentor-onboarding=true'
    );
    expect(getBecomeMentorHref(undefined)).toBe('/auth/signup');
    expect(getMentorScheduleManagementUrl('u1')).toBe(
      '/profile/u1?open-schedule=true'
    );
    expect(getOpenScheduleHref('u1')).toBe('/profile/u1?open-schedule=true');
    expect(getOpenScheduleHref(undefined)).toBe('/');
  });
});
