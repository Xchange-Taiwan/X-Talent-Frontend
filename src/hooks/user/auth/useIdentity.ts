'use client';

import { useMemo } from 'react';

import { applyAvatarOverride, ResolvedIdentity } from '@/lib/auth/sessionHint';

import { useResolvedIdentity } from './useResolvedIdentity';

/**
 * Custom Hook exposing the app's single resolved identity value - the
 * identity `useResolvedIdentity` already resolved, with an optional
 * client-only avatar override layered on top.
 *
 * Callers that don't care about the avatar (e.g. `useAuthStatus`, `useProfileAuth`)
 * must pass `null` rather than omitting the argument, so this hook never has to
 * subscribe to the avatar override store itself and trigger unrelated re-renders.
 */
export function useIdentity(
  override: { userId: string; url: string } | null
): ResolvedIdentity {
  const identity = useResolvedIdentity();

  return useMemo(
    () => applyAvatarOverride(identity, override),
    [identity, override]
  );
}
