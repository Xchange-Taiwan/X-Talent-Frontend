'use client';

import type { StaticImageData } from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { UserType } from '@/hooks/user/user-data/useUserData';
import {
  buildMenteeDirectionReadGroups,
  isMenteeProfileEmpty,
  type MenteeDirectionReadGroup,
  readStoredMenteeDirectionViewMap,
  resolveMenteeAvatarSrc,
  resolveMenteeExperienceSummary,
  resolveMenteeIndustryHashtag,
  resolveMenteeLatestRole,
  type StoredMenteeDirectionMap,
} from '@/lib/profile/menteeDirectionView';

export interface UseMenteeProfileViewInput {
  userData: UserType | null;
  avatarSrc: string | StaticImageData;
  resolvedLocation?: string;
  safePersonalLinksCount: number;
  storedDirectionMap?: StoredMenteeDirectionMap | null;
}

export interface UseMenteeProfileViewResult {
  menteeIndustryHashtag: string | null;
  menteeDirectionGroups: MenteeDirectionReadGroup[];
  activeMenteeDirection: string | null;
  setActiveMenteeDirection: (nextKey: string | null) => void;
  menteeEmpty: boolean;
  effectiveAvatarSrc: string | StaticImageData;
  menteeLatestRole: { jobTitle: string; company: string } | null;
  menteeExperienceDisplay: string | undefined;
}

export function useMenteeProfileView({
  userData,
  avatarSrc,
  resolvedLocation,
  safePersonalLinksCount,
  storedDirectionMap,
}: UseMenteeProfileViewInput): UseMenteeProfileViewResult {
  const isMentee = Boolean(userData && !userData.is_mentor);
  const menteeUserKey =
    isMentee && userData?.user_id !== undefined
      ? String(userData.user_id)
      : null;

  const [storedMapState, setStoredMapState] = useState<{
    userKey: string | null;
    map: StoredMenteeDirectionMap | null;
  }>(() => ({
    userKey: menteeUserKey,
    map: storedDirectionMap !== undefined ? storedDirectionMap : null,
  }));

  useEffect(() => {
    if (storedDirectionMap !== undefined) {
      setStoredMapState({ userKey: menteeUserKey, map: storedDirectionMap });
      return;
    }
    if (!menteeUserKey) {
      setStoredMapState({ userKey: null, map: null });
      return;
    }
    setStoredMapState({
      userKey: menteeUserKey,
      map: readStoredMenteeDirectionViewMap(menteeUserKey),
    });
  }, [menteeUserKey, storedDirectionMap]);

  const effectiveStoredMap =
    storedDirectionMap !== undefined
      ? storedDirectionMap
      : storedMapState.userKey === menteeUserKey
        ? storedMapState.map
        : null;

  const menteeDirectionGroups = useMemo<MenteeDirectionReadGroup[]>(() => {
    if (!userData || userData.is_mentor) return [];
    return buildMenteeDirectionReadGroups({
      positions: userData.want_position,
      skills: userData.want_skill,
      topics: userData.want_topic,
      storedMap: effectiveStoredMap,
    });
  }, [userData, effectiveStoredMap]);

  const [selectedDirectionState, setSelectedDirectionState] = useState<{
    userKey: string | null;
    direction: string | null;
  }>({
    userKey: null,
    direction: null,
  });

  const setActiveMenteeDirection = useCallback(
    (nextKey: string | null) => {
      setSelectedDirectionState({
        userKey: menteeUserKey,
        direction: nextKey,
      });
    },
    [menteeUserKey]
  );

  // Synchronously derive the active direction scoped by `menteeUserKey` so both
  // left-column MenteeProfileContent and right-column MenteeWatchedPositionsCard
  // agree on the first SSR/CSR paint AND reset immediately to `groups[0]` when
  // switching between Mentees even if they share a position code (#960).
  const activeMenteeDirection = useMemo<string | null>(() => {
    if (menteeDirectionGroups.length === 0) return null;
    const candidate =
      selectedDirectionState.userKey === menteeUserKey
        ? selectedDirectionState.direction
        : null;
    if (candidate && menteeDirectionGroups.some((g) => g.key === candidate)) {
      return candidate;
    }
    return menteeDirectionGroups[0].key;
  }, [menteeDirectionGroups, menteeUserKey, selectedDirectionState]);

  const menteeIndustryHashtag = useMemo<string | null>(() => {
    if (!userData || userData.is_mentor) return null;
    return resolveMenteeIndustryHashtag(userData);
  }, [userData]);

  const menteeEmpty = useMemo<boolean>(() => {
    if (!userData || userData.is_mentor) return false;
    return isMenteeProfileEmpty(
      userData,
      safePersonalLinksCount,
      resolvedLocation
    );
  }, [userData, safePersonalLinksCount, resolvedLocation]);

  const effectiveAvatarSrc = useMemo<string | StaticImageData>(() => {
    if (!userData || userData.is_mentor) return avatarSrc;
    return resolveMenteeAvatarSrc(userData.avatar);
  }, [avatarSrc, userData]);

  const menteeLatestRole = useMemo(() => {
    if (!userData || userData.is_mentor) return null;
    return resolveMenteeLatestRole(userData);
  }, [userData]);

  const menteeExperienceDisplay = useMemo(() => {
    if (!userData || userData.is_mentor) return undefined;
    return resolveMenteeExperienceSummary(userData);
  }, [userData]);

  return {
    menteeIndustryHashtag,
    menteeDirectionGroups,
    activeMenteeDirection,
    setActiveMenteeDirection,
    menteeEmpty,
    effectiveAvatarSrc,
    menteeLatestRole,
    menteeExperienceDisplay,
  };
}
