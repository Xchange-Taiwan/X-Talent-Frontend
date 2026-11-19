'use client';

import { useCallback, useRef, useSyncExternalStore } from 'react';

import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import {
  createMentorScheduleSession,
  type MentorScheduleSession,
  type MentorScheduleSessionConfig,
  type MentorScheduleSessionSnapshot,
} from '@/lib/mentor-schedule/mentorScheduleSession';

type Options = MentorScheduleSessionConfig;

export type UseMentorScheduleReturn = MentorScheduleSessionSnapshot;

export function useMentorSchedule(opts: Options): UseMentorScheduleReturn {
  const { backend, loginUserId, includeBookedDates = false } = opts;

  const sessionRef = useRef<MentorScheduleSession | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createMentorScheduleSession(undefined, undefined, {
      initialConfig: {
        backend: {
          userId: backend.userId,
          year: backend.year,
          month: backend.month,
        },
        loginUserId,
        includeBookedDates,
      },
    });
  }
  const session = sessionRef.current;

  useIsomorphicLayoutEffect(() => {
    session.configure({
      backend: {
        userId: backend.userId,
        year: backend.year,
        month: backend.month,
      },
      loginUserId,
      includeBookedDates,
    });
  }, [
    session,
    backend.userId,
    backend.year,
    backend.month,
    loginUserId,
    includeBookedDates,
  ]);

  useIsomorphicLayoutEffect(() => {
    return () => {
      session.dispose();
    };
  }, [session]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => session.subscribe(onStoreChange),
    [session]
  );
  const getSnapshot = useCallback(() => session.getSnapshot(), [session]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
