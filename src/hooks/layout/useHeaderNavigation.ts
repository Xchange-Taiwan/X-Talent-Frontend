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

function readIsMentorOnboardingFromLocation(pathname: string | null): boolean {
  if (!pathname?.endsWith('/edit') || typeof window === 'undefined') {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  return (
    params.get(MENTOR_ONBOARDING_KEY) === 'true' ||
    params.get('onboarding') === 'true'
  );
}

const LOCATION_CHANGE_EVENT = 'xtalent:locationchange';

function ensureHistoryPatched(): void {
  if (typeof window === 'undefined') return;
  const win = window as Window & { __xtalentHistoryPatched?: boolean };
  if (win.__xtalentHistoryPatched) return;
  win.__xtalentHistoryPatched = true;

  const origPushState = window.history.pushState.bind(window.history);
  window.history.pushState = (
    data: unknown,
    unused: string,
    url?: string | URL | null
  ) => {
    origPushState(data, unused, url);
    window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
  };

  const origReplaceState = window.history.replaceState.bind(window.history);
  window.history.replaceState = (
    data: unknown,
    unused: string,
    url?: string | URL | null
  ) => {
    origReplaceState(data, unused, url);
    window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
  };
}

export function useHeaderNavigation({
  identity,
  user,
  showFavorites,
}: UseHeaderNavigationOptions): HeaderNavigationModel {
  const pathname = usePathname();
  const [isMentorOnboarding, setIsMentorOnboarding] = React.useState(false);
  const [activeDialog, setActiveDialog] =
    React.useState<HeaderDialogType | null>(null);
  const dialogRafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    ensureHistoryPatched();
    const sync = () => {
      setIsMentorOnboarding(readIsMentorOnboardingFromLocation(pathname));
    };
    sync();
    window.addEventListener('popstate', sync);
    window.addEventListener(LOCATION_CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(LOCATION_CHANGE_EVENT, sync);
    };
  }, [pathname]);

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
