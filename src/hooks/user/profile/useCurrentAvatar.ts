'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { useSessionHint } from '@/hooks/user/auth/useSessionHint';
import { resolveIdentity } from '@/lib/auth/sessionHint';
import {
  clearAvatarOverride,
  useAvatarOverride,
} from '@/lib/avatar/avatarOverrideStore';

/**
 * Returns the avatar URL to render for the currently signed-in user.
 *
 * Reads from a client-side override (set synchronously on a successful
 * profile submit) and falls back to the NextAuth session or session hint.
 * Bridges the gap left by NextAuth v4's `update()` round-trip — without it
 * the header shows the old avatar between submit and the session refetch landing.
 */
export function useCurrentAvatar(): string | null {
  const { data: session, status } = useSession();
  const hintState = useSessionHint();
  const override = useAvatarOverride();
  const sessionUserId = session?.user?.id ?? null;
  const sessionAvatar = session?.user?.avatar ?? null;

  useEffect(() => {
    if (!override) return;
    if (override.userId !== sessionUserId) {
      clearAvatarOverride();
      return;
    }
    if (sessionAvatar === override.url) {
      clearAvatarOverride();
    }
  }, [override, sessionUserId, sessionAvatar]);

  const hint = hintState.status === 'authenticated' ? hintState : null;
  const identity = resolveIdentity(override, session, status, hint);

  return identity.avatar ?? null;
}
