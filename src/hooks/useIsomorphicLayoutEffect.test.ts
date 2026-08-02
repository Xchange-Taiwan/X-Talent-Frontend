import { useEffect, useLayoutEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('useIsomorphicLayoutEffect', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('should be useLayoutEffect on client (when window is defined)', async () => {
    const { useIsomorphicLayoutEffect } =
      await import('./useIsomorphicLayoutEffect');
    expect(useIsomorphicLayoutEffect).toBe(useLayoutEffect);
  });

  it('should be useEffect on server (when window is undefined)', async () => {
    // Safely stub window as undefined to simulate SSR/server-side environment
    vi.stubGlobal('window', undefined);

    // Reset Vitest module cache so the imported file evaluates in the modified environment
    vi.resetModules();

    const { useIsomorphicLayoutEffect: serverEffect } =
      await import('./useIsomorphicLayoutEffect');
    expect(serverEffect).toBe(useEffect);
  });
});
