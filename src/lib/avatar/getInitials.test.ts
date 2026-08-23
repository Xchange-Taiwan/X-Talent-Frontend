import { describe, expect, it } from 'vitest';

import { getInitials } from './getInitials';

describe('getInitials', () => {
  it('returns initials for two-word names', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('returns initial for a single-word name', () => {
    expect(getInitials('John')).toBe('J');
  });

  it('returns up to 2 initials', () => {
    expect(getInitials('John Doe Smith')).toBe('JD');
  });

  it('handles multiple whitespaces', () => {
    expect(getInitials('  John    Doe  ')).toBe('JD');
  });

  it('returns U for empty or undefined/null values', () => {
    expect(getInitials('')).toBe('U');
    expect(getInitials(null)).toBe('U');
    expect(getInitials(undefined)).toBe('U');
  });

  it('uppercases initials', () => {
    expect(getInitials('john doe')).toBe('JD');
  });
});
