import { beforeEach, describe, expect, it, vi } from 'vitest';

import { safeGetStorage, safeSetStorage } from './storage';

describe('storage utils', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('safely sets and gets items from localStorage in standard environments', () => {
    safeSetStorage('test-key', 'value-123');
    expect(safeGetStorage('test-key')).toBe('value-123');
  });

  it('returns null if item does not exist in localStorage', () => {
    expect(safeGetStorage('non-existent-key')).toBeNull();
  });

  it('handles item reading failures gracefully when localStorage is blocked or throws', () => {
    const getItemSpy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('localStorage is blocked');
      });

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(safeGetStorage('any-key')).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();

    getItemSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('handles item writing failures gracefully when localStorage is blocked or throws', () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('localStorage is blocked');
      });

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => safeSetStorage('any-key', 'any-value')).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalled();

    setItemSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
