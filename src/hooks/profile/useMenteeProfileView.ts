'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { UserType } from '@/hooks/user/user-data/useUserData';
import {
  buildMenteeDirectionReadGroups,
  type MenteeDirectionMap,
  type MenteeDirectionReadGroup,
  readStoredMenteeDirectionMap,
} from '@/lib/profile/menteeDirectionPreference';

export interface UseMenteeProfileViewInput {
  userData: UserType | null;
  storedDirectionMap?: MenteeDirectionMap | null;
}

export interface UseMenteeProfileViewResult {
  menteeDirectionGroups: MenteeDirectionReadGroup[];
  activeMenteeDirection: string | null;
  setActiveMenteeDirection: (nextKey: string | null) => void;
}

export function useMenteeProfileView({
  userData,
  storedDirectionMap,
}: UseMenteeProfileViewInput): UseMenteeProfileViewResult {
  const isMentee = Boolean(userData && !userData.is_mentor);
  const menteeUserKey =
    isMentee && userData?.user_id !== undefined
      ? String(userData.user_id)
      : null;

  const [storedMapState, setStoredMapState] = useState<{
    userKey: string | null;
    map: MenteeDirectionMap | null;
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
      map: readStoredMenteeDirectionMap(menteeUserKey),
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

  return {
    menteeDirectionGroups,
    activeMenteeDirection,
    setActiveMenteeDirection,
  };
}
