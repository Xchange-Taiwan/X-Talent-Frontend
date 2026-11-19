'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  hydrateMenteeDirectionMap,
  type MenteeDirectionMap,
  readStoredMenteeDirectionMap,
  writeStoredMenteeDirectionMap,
} from '@/lib/profile/menteeDirectionPreference';
import type { MentorProfileVO } from '@/types/user';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface UseMenteeDirectionPreferenceResult {
  directionMap: MenteeDirectionMap;
  setDirectionMap: (next: MenteeDirectionMap) => void;
  isDirectionMapDirty: boolean;
  persistDirectionMap: () => void;
}

/**
 * Encapsulates one-time hydration, dirty-state comparison, and safe
 * `localStorage` persistence for Mentee direction-scoped skill/topic maps.
 */
export function useMenteeDirectionPreference(
  pageUserId: string,
  userDto: MentorProfileVO | null | undefined
): UseMenteeDirectionPreferenceResult {
  const [directionMap, setDirectionMap] = useState<MenteeDirectionMap>({});
  const [initialJson, setInitialJson] = useState<string>('{}');
  const latestMapRef = useRef<MenteeDirectionMap>(directionMap);
  latestMapRef.current = directionMap;
  const hydratedUserRef = useRef<string | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!userDto) {
      hydratedUserRef.current = null;
      return;
    }
    if (hydratedUserRef.current === pageUserId) return;
    hydratedUserRef.current = pageUserId;

    const stored = readStoredMenteeDirectionMap(pageUserId);
    const hydrated = hydrateMenteeDirectionMap({
      positions: (userDto.want_position ?? []).slice(0, 1),
      flatSkills: userDto.want_skill ?? [],
      flatTopics: userDto.want_topic ?? [],
      storedMap: stored,
    });
    const serialized = JSON.stringify(hydrated);
    setDirectionMap(hydrated);
    setInitialJson(serialized);
  }, [pageUserId, userDto]);

  const isDirectionMapDirty = useMemo(
    () => JSON.stringify(directionMap) !== initialJson,
    [directionMap, initialJson]
  );

  const persistDirectionMap = useCallback(() => {
    writeStoredMenteeDirectionMap(pageUserId, latestMapRef.current);
    setInitialJson(JSON.stringify(latestMapRef.current));
  }, [pageUserId]);

  return {
    directionMap,
    setDirectionMap,
    isDirectionMapDirty,
    persistDirectionMap,
  };
}
