'use client';

import { ResolvedIdentity } from '@/lib/auth/sessionHint';

import { useResolvedIdentity } from './useResolvedIdentity';

/**
 * Custom Hook exposing the app's single resolved identity value - the
 * identity `useResolvedIdentity` already resolved.
 */
export function useIdentity(): ResolvedIdentity {
  return useResolvedIdentity();
}
