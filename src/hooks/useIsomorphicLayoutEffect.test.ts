import { useEffect, useLayoutEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

describe('useIsomorphicLayoutEffect', () => {
  it('should be useLayoutEffect on client (when window is defined)', async () => {
    const { useIsomorphicLayoutEffect } =
      await import('./useIsomorphicLayoutEffect');
    expect(useIsomorphicLayoutEffect).toBe(useLayoutEffect);
  });

  it('should be useEffect on server (when window is undefined)', async () => {
    // Backup window and mock undefined
    const originalWindow = global.window;

    try {
      // @ts-expect-error - dynamically removing window to simulate SSR
      delete global.window;

      // Reset Vitest module cache so the imported file evaluates in the modified environment
      vi.resetModules();

      const { useIsomorphicLayoutEffect: serverEffect } =
        await import('./useIsomorphicLayoutEffect');
      expect(serverEffect).toBe(useEffect);
    } finally {
      global.window = originalWindow;
      vi.resetModules();
    }
  });
});
