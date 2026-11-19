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

  it('keeps history observer active across multiple subscribers, notifies on popstate, and avoids clobbering outer wrappers', async () => {
    const originalPush = window.history.pushState;
    const originalHref = window.location.href;

    try {
      const listenerA = vi.fn();
      const listenerB = vi.fn();
      const unsubA = subscribeLocationSearch(listenerA);
      const unsubB = subscribeLocationSearch(listenerB);

      // Unsubscribing A while B remains active keeps pushState patched
      unsubA();
      expect(window.history.pushState).not.toBe(originalPush);

      window.history.pushState(
        {},
        '',
        '/profile/2/edit?mentor-onboarding=true'
      );
      await Promise.resolve();
      expect(listenerA).not.toHaveBeenCalled();
      expect(listenerB).toHaveBeenCalledTimes(1);

      // Popstate event coalesces and notifies remaining subscriber
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.dispatchEvent(new PopStateEvent('popstate'));
      await Promise.resolve();
      expect(listenerB).toHaveBeenCalledTimes(2);

      // Simulate a third-party wrapper (e.g. Sentry) wrapping pushState after us
      const innerPatched = window.history.pushState;
      const outerWrapperCalls = vi.fn();
      const outerWrapper: typeof window.history.pushState = (
        data,
        unused,
        url
      ) => {
        outerWrapperCalls();
        innerPatched.call(window.history, data, unused, url);
      };
      window.history.pushState = outerWrapper;

      // Unsubscribing last listener must NOT overwrite outerWrapper
      unsubB();
      expect(window.history.pushState).toBe(outerWrapper);

      window.history.pushState({}, '', '/profile/2');
      await Promise.resolve();
      expect(outerWrapperCalls).toHaveBeenCalledTimes(1);
      expect(listenerB).toHaveBeenCalledTimes(2);
    } finally {
      window.history.pushState = originalPush;
      window.history.replaceState({}, '', originalHref);
    }
  });
});
