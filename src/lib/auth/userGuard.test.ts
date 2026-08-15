import { describe, expect, it } from 'vitest';

import { hasUserProperties } from './userGuard';

describe('hasUserProperties (User Session Type Guard)', () => {
  it('should return false for null and undefined', () => {
    expect(hasUserProperties(null)).toBe(false);
    expect(hasUserProperties(undefined)).toBe(false);
  });

  it('should return false for primitive values', () => {
    expect(hasUserProperties('string')).toBe(false);
    expect(hasUserProperties(123)).toBe(false);
    expect(hasUserProperties(true)).toBe(false);
  });

  it('should return false for empty objects or unrelated objects', () => {
    expect(hasUserProperties({})).toBe(false);
    expect(hasUserProperties({ name: 'unrelated' })).toBe(false);
  });

  it('should return true for objects containing id', () => {
    expect(hasUserProperties({ id: 'user-123' })).toBe(true);
  });

  it('should return true for objects containing onBoarding', () => {
    expect(hasUserProperties({ onBoarding: true })).toBe(true);
    expect(hasUserProperties({ onBoarding: false })).toBe(true);
  });

  it('should return true for fully populated session user objects', () => {
    expect(hasUserProperties({ id: 'user-123', onBoarding: true })).toBe(true);
  });
});
