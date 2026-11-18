import { describe, expect, it, vi } from 'vitest';

import {
  getLocationSearchSnapshot,
  subscribeLocationSearch,
} from './locationSearchStore';

describe('locationSearchStore (#961)', () => {
  it('notifies subscribers on pushState/replaceState and restores original history methods when last subscriber unsubscribes', async () => {
    const originalPush = window.history.pushState;
    const originalReplace = window.history.replaceState;
    const originalHref = window.location.href;

    try {
      const listener = vi.fn();
      const unsubscribe = subscribeLocationSearch(listener);

      expect(window.history.pushState).not.toBe(originalPush);

      window.history.pushState(
        {},
        '',
        '/profile/1/edit?mentor-onboarding=true'
      );
      await Promise.resolve();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(getLocationSearchSnapshot()).toBe('?mentor-onboarding=true');

      window.history.replaceState({}, '', '/profile/1/edit');
      await Promise.resolve();
      expect(listener).toHaveBeenCalledTimes(2);
      expect(getLocationSearchSnapshot()).toBe('');

      unsubscribe();
      expect(window.history.pushState).toBe(originalPush);
      expect(window.history.replaceState).toBe(originalReplace);
    } finally {
      window.history.replaceState({}, '', originalHref);
    }
  });
});
