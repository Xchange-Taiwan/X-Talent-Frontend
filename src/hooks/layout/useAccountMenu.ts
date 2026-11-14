'use client';

import { useRouter } from 'next/navigation';
import type { Session } from 'next-auth';
import { signOut } from 'next-auth/react';
import * as React from 'react';

import { ResolvedIdentity } from '@/lib/auth/sessionHint';
import { terminateClientSession } from '@/lib/auth/sessionLifecycle';
import {
  getMentorOnboardingUrl,
  HOME_HREF,
  RESERVATION_MENTEE_HREF,
  RESERVATION_MENTOR_HREF,
} from '@/lib/routes';
import type { PersonalLink } from '@/types/types';

export interface UseAccountMenuOptions {
  identity: ResolvedIdentity;
  user?: Session['user'];
  /**
   * Closes whatever outer container (dropdown/sheet) the caller is
   * rendered inside. Every handler except `handleShareProfile` calls this
   * before acting — the share flow is the one case where mobile and
   * desktop diverge on whether to close first, so shells compose their
   * own choreography around `handleShareProfile` instead.
   */
  closeMenu: () => void;
}

export interface UseAccountMenuResult {
  userId: string | undefined;
  isMentor: boolean;
  canDeleteAccount: boolean;
  name: string;
  avatarSrc: string;
  subtitle: string;
  personalLinks: PersonalLink[];
  profilePath: string;
  shareDialogOpen: boolean;
  setShareDialogOpen: (open: boolean) => void;
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
  handleGoProfile: () => void;
  handleShareProfile: () => void;
  handleAsMentor: () => void;
  handleMyReservation: () => void;
  handleDeleteAccount: () => void;
  handleLogout: () => void;
}

export function useAccountMenu({
  identity,
  user,
  closeMenu,
}: UseAccountMenuOptions): UseAccountMenuResult {
  const router = useRouter();
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  const userId = identity.userId;
  const isMentor = Boolean(identity.isMentor);
  const canDeleteAccount =
    process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT === 'true';
  const name = identity.name ?? user?.name ?? '';
  const avatarSrc = identity.avatar ?? user?.avatar ?? '';
  const jobTitle = identity.jobTitle ?? user?.jobTitle ?? '';
  const company = identity.company ?? user?.company ?? '';
  const personalLinks = identity.personalLinks ?? user?.personalLinks ?? [];

  const profilePath = userId ? `/profile/${userId}` : HOME_HREF;

  const subtitle =
    jobTitle && company
      ? `${jobTitle} at ${company}`
      : jobTitle || company || '';

  const handleGoProfile = React.useCallback((): void => {
    closeMenu();
    router.push(profilePath);
  }, [closeMenu, router, profilePath]);

  const handleShareProfile = React.useCallback((): void => {
    if (!userId) return;
    setShareDialogOpen(true);
  }, [userId]);

  const handleAsMentor = React.useCallback((): void => {
    if (!userId) return;
    closeMenu();
    if (isMentor) {
      router.push(RESERVATION_MENTOR_HREF);
    } else {
      router.push(getMentorOnboardingUrl(userId));
    }
  }, [closeMenu, router, userId, isMentor]);

  const handleMyReservation = React.useCallback((): void => {
    closeMenu();
    router.push(RESERVATION_MENTEE_HREF);
  }, [closeMenu, router]);

  const handleDeleteAccount = React.useCallback((): void => {
    closeMenu();
    requestAnimationFrame(() => {
      setDeleteDialogOpen(true);
    });
  }, [closeMenu]);

  const handleLogout = React.useCallback(async (): Promise<void> => {
    closeMenu();
    await terminateClientSession('logout', { signOut });
  }, [closeMenu]);

  return {
    userId,
    isMentor,
    canDeleteAccount,
    name,
    avatarSrc,
    subtitle,
    personalLinks,
    profilePath,
    shareDialogOpen,
    setShareDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    handleGoProfile,
    handleShareProfile,
    handleAsMentor,
    handleMyReservation,
    handleDeleteAccount,
    handleLogout,
  };
}
