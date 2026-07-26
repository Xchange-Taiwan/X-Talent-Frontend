import { describe, expect, it } from 'vitest';

import { getSafeErrorMessage } from './errorUtils';

describe('getSafeErrorMessage', () => {
  it('returns the error directly if it is a string', () => {
    const error = 'Failed to load profile';
    expect(getSafeErrorMessage(error)).toBe('Failed to load profile');
  });

  it('extracts message if error is an instance of Error', () => {
    const error = new Error('Database connection failed');
    expect(getSafeErrorMessage(error)).toBe('Database connection failed');
  });

  it('extracts message if error is a custom object with a message property', () => {
    const error = {
      message: 'Network Timeout',
      config: { headers: { Authorization: 'Bearer token123' } },
    };
    expect(getSafeErrorMessage(error)).toBe('Network Timeout');
  });

  it('returns Unknown error for null or undefined errors', () => {
    expect(getSafeErrorMessage(null)).toBe('Unknown error');
    expect(getSafeErrorMessage(undefined)).toBe('Unknown error');
  });

  it('returns Unknown error for non-error types without a message property', () => {
    expect(getSafeErrorMessage(404)).toBe('Unknown error');
    expect(getSafeErrorMessage({})).toBe('Unknown error');
  });
});
