'use client';

import { usePathname } from 'next/navigation';
import type { Session } from 'next-auth';
import { signOut } from 'next-auth/react';
import * as React from 'react';

import { trackEvent } from '@/lib/analytics';
import type { ResolvedIdentity } from '@/lib/auth/sessionHint';
import { terminateClientSession } from '@/lib/auth/sessionLifecycle';
import {
  isAccountDeletionEnabled,
  isFavoritesEnabled,
} from '@/lib/featureFlags';
import {
  bindHeaderNavigationCallbacks,
  type BoundHeaderNavigationMenus,
  buildHeaderNavigationModel,
  type HeaderActionIntent,
  type HeaderDialogType,
  toResolvedIdentitySnapshot,
} from '@/lib/navigation/headerNavigationModel';
import {
  getLocationSearchSnapshot,
  subscribeLocationSearch,
} from '@/lib/navigation/locationSearchStore';
import { MENTOR_ONBOARDING_KEY } from '@/lib/routes';

export * from '@/lib/navigation/headerNavigationModel';

export interface UseHeaderNavigationOptions {
  identity: ResolvedIdentity;
  user?: Session['user'];
  showFavorites?: boolean;
}

export interface HeaderNavigationModel extends BoundHeaderNavigationMenus {
  identity: ResolvedIdentity;
  activeDialog: HeaderDialogType | null;
  setActiveDialog: React.Dispatch<
    React.SetStateAction<HeaderDialogType | null>
  >;
}

function clearDialogRaf(ref: React.MutableRefObject<number | null>): void {
  if (ref.current !== null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(ref.current);
    ref.current = null;
  }
}

function handleFeedbackClick(): void {
  trackEvent({ name: 'feedback_open' });
}

function parseIsMentorOnboarding(
  pathname: string | null,
  rawSearch: string
): boolean {
  if (!pathname?.endsWith('/edit') || !rawSearch) {
    return false;
  }
  const params = new URLSearchParams(rawSearch);
  return (
    params.get(MENTOR_ONBOARDING_KEY) === 'true' ||
    params.get('onboarding') === 'true'
  );
}

export function useHeaderNavigation({
  identity,
  user,
  showFavorites,
}: UseHeaderNavigationOptions): HeaderNavigationModel {
  const pathname = usePathname();
  // Hydration-safe location.search state: initializes to '' on both SSR and
  // first client hydration pass, then syncs on mount and on History updates.
  const [rawLocationSearch, setRawLocationSearch] = React.useState('');
  React.useEffect(() => {
    const sync = () => {
      setRawLocationSearch(getLocationSearchSnapshot());
    };
    sync();
    return subscribeLocationSearch(sync);
  }, [pathname]);

  const isMentorOnboarding = React.useMemo(
    () => parseIsMentorOnboarding(pathname, rawLocationSearch),
    [pathname, rawLocationSearch]
  );
  const [activeDialog, setActiveDialog] =
    React.useState<HeaderDialogType | null>(null);
  const dialogRafRef = React.useRef<number | null>(null);

  const isUserUnresolved = identity.state === 'hint-only' || !identity.userId;
  const canDeleteAccount = isAccountDeletionEnabled();
  const favoritesEnabled = showFavorites ?? isFavoritesEnabled();

  React.useEffect(() => () => clearDialogRaf(dialogRafRef), []);

  React.useEffect(() => {
    clearDialogRaf(dialogRafRef);
    setActiveDialog(null);
  }, [isUserUnresolved, identity.userId]);

  const handleAction = React.useCallback(
    (
      intent: HeaderActionIntent,
      closeMenu?: () => void
    ): void | Promise<void> => {
      if (intent === 'logout') {
        closeMenu?.();
        clearDialogRaf(dialogRafRef);
        setActiveDialog(null);
        return terminateClientSession('logout', { signOut });
      }
      if (
        isUserUnresolved ||
        (intent === 'delete-account' && !canDeleteAccount)
      ) {
        return;
      }
      closeMenu?.();
      clearDialogRaf(dialogRafRef);
      if (typeof requestAnimationFrame !== 'function') {
        setActiveDialog(intent);
        return;
      }
      dialogRafRef.current = requestAnimationFrame(() => {
        dialogRafRef.current = null;
        setActiveDialog(intent);
      });
    },
    [canDeleteAccount, isUserUnresolved]
  );

  const {
    state,
    userId,
    isMentor,
    avatar,
    name,
    jobTitle,
    company,
    personalLinks,
  } = identity;
  const stableIdentity = React.useMemo(
    () =>
      toResolvedIdentitySnapshot(
        state,
        userId,
        isMentor,
        avatar,
        name,
        jobTitle,
        company,
        personalLinks
      ),
    [avatar, company, isMentor, jobTitle, name, personalLinks, state, userId]
  );

  const boundMenus = React.useMemo(
    () =>
      bindHeaderNavigationCallbacks(
        buildHeaderNavigationModel({
          identity: stableIdentity,
          user,
          pathname,
          isMentorOnboarding,
          showFavorites: favoritesEnabled,
          canDeleteAccount,
        }),
        { onFeedbackClick: handleFeedbackClick, onAction: handleAction }
      ),
    [
      canDeleteAccount,
      favoritesEnabled,
      handleAction,
      isMentorOnboarding,
      pathname,
      stableIdentity,
      user,
    ]
  );

  return React.useMemo<HeaderNavigationModel>(
    () => ({ identity, ...boundMenus, activeDialog, setActiveDialog }),
    [identity, boundMenus, activeDialog]
  );
}
