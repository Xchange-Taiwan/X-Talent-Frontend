import { describe, expect, it } from 'vitest';

import {
  getErrorMessage,
  getSafeErrorMessage,
  isAbortError,
} from './errorUtils';

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

describe('getErrorMessage', () => {
  it('returns message if error has one', () => {
    const error = new Error('Database connection failed');
    expect(getErrorMessage(error)).toBe('Database connection failed');
  });

  it('returns Chinese fallback if error does not have message', () => {
    expect(getErrorMessage(null)).toBe('發生錯誤，請稍後再試。');
    expect(getErrorMessage({})).toBe('發生錯誤，請稍後再試。');
  });
});

describe('isAbortError', () => {
  it('returns true if the AbortSignal is aborted', () => {
    const controller = new AbortController();
    controller.abort();
    expect(isAbortError(null, controller.signal)).toBe(true);
  });

  it('returns true for DOMException AbortError', () => {
    const error = new DOMException('Aborted', 'AbortError');
    expect(isAbortError(error)).toBe(true);
  });

  it('returns true for normal Error with name AbortError', () => {
    const error = new Error('Aborted');
    error.name = 'AbortError';
    expect(isAbortError(error)).toBe(true);
  });

  it('returns false for other errors', () => {
    const error = new Error('Normal error');
    expect(isAbortError(error)).toBe(false);
  });
});
