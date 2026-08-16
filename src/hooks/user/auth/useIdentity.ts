'use client';

import { useSession } from 'next-auth/react';

import { ResolvedIdentity, resolveIdentity } from '@/lib/auth/sessionHint';
import { useAvatarOverride } from '@/lib/avatar/avatarOverrideStore';

import { useSessionHint } from './useSessionHint';

/**
 * Custom Hook that combines `useSession()`, `useSessionHint()` and optional avatar override
 * to resolve the unified user authentication identity synchronously.
 */
export function useIdentity(
  overrideInput?: { userId: string; url: string } | null
): ResolvedIdentity {
  const { data: session, status } = useSession();
  const hint = useSessionHint();
  const localOverride = useAvatarOverride();
  const override = overrideInput !== undefined ? overrideInput : localOverride;

  return resolveIdentity(override, session, status, hint);
}
