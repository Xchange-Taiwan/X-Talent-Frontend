import { describe, expect, it } from 'vitest';

import { getBecomeMentorHref, getProfileHref } from './navHrefs';

describe('navHrefs', () => {
  describe('getProfileHref', () => {
    it('returns the profile URL when userId is present', () => {
      expect(getProfileHref('user-123')).toBe('/profile/user-123');
    });

    it('falls back to "/" when userId is undefined', () => {
      expect(getProfileHref(undefined)).toBe('/');
    });
  });

  describe('getBecomeMentorHref', () => {
    it('returns the onboarding edit URL when userId is present', () => {
      expect(getBecomeMentorHref('user-123')).toBe(
        '/profile/user-123/edit?onboarding=true'
      );
    });

    it('falls back to signup when userId is undefined', () => {
      expect(getBecomeMentorHref(undefined)).toBe('/auth/signup');
    });
  });
});
