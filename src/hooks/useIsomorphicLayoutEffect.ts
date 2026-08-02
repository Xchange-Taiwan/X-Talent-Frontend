import { useEffect, useLayoutEffect } from 'react';

/**
 * A safe hook that resolves to `useLayoutEffect` on the client
 * and `useEffect` on the server (to prevent SSR hydration mismatch warnings).
 */
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
