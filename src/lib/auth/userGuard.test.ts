import { describe, expect, it } from 'vitest';

import { hasUserProperties, isValidUserId } from './userGuard';

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

describe('isValidUserId', () => {
  it('accepts a plain positive integer string', () => {
    expect(isValidUserId('42')).toBe(true);
  });

  // Server Actions using this are callable directly with any payload,
  // bypassing whatever UI normally supplies `userId` — these are the
  // shapes a hand-crafted request could send.
  it.each([
    ['path traversal', '../about'],
    ['non-numeric garbage', 'abc'],
    ['leading zero-width numeric-looking id', '1e5'],
    ['negative number', '-1'],
    ['decimal', '1.5'],
    ['empty string', ''],
    ['a number, not a string', 42],
    ['null', null],
    ['undefined', undefined],
  ])('rejects %s (%p)', (_label, userId) => {
    expect(isValidUserId(userId)).toBe(false);
  });
});
