'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  type AvatarUploadSession,
  createAvatarUploadSession,
} from '@/services/profile/avatarUploadSession';

export interface UseBackgroundAvatarUpload {
  stage: (file: File, currentAvatarUrl: string | null | undefined) => void;
  kickOff: (file: File, currentAvatarUrl: string | null | undefined) => void;
  resolve: (file: File | undefined) => Promise<string | undefined>;
  markCommitted: () => void;
  rollback: () => Promise<void>;
  abort: () => void;
  prefetch: (targetUserId?: number) => void;
  clearStaged: () => Promise<void>;
}

function normalizeNumericUserId(
  value: number | string | null | undefined
): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Thin React adapter over `AvatarUploadSession` binding a per-component
 * upload session instance, explicit user identity, and automatic unmount
 * rollback cleanup. The returned object is referentially stable so it can be
 * handed to ProfileSavePort.avatarSession directly.
 */
export function useBackgroundAvatarUpload(
  userId: number | string | null | undefined
): UseBackgroundAvatarUpload {
  const resolvedUserId = normalizeNumericUserId(userId);

  const userIdRef = useRef<number | undefined>(resolvedUserId);
  const sessionRef = useRef<AvatarUploadSession | null>(null);
  if (!sessionRef.current) {
    sessionRef.current = createAvatarUploadSession({
      userId: () => userIdRef.current,
    });
  }

  useEffect(() => {
    userIdRef.current = resolvedUserId;
    if (resolvedUserId !== undefined) {
      sessionRef.current?.prefetch(resolvedUserId);
    }
  }, [resolvedUserId]);

  const prefetch = useCallback((targetUserId?: number) => {
    sessionRef.current?.prefetch(targetUserId);
  }, []);

  const stage = useCallback(
    (file: File, currentAvatarUrl: string | null | undefined) => {
      sessionRef.current?.stage(file, currentAvatarUrl);
    },
    []
  );

  const resolve = useCallback(
    (file: File | undefined): Promise<string | undefined> =>
      sessionRef.current
        ? sessionRef.current.resolve(file)
        : Promise.resolve(undefined),
    []
  );

  const markCommitted = useCallback(() => {
    sessionRef.current?.markCommitted();
  }, []);

  const rollback = useCallback(async (): Promise<void> => {
    await sessionRef.current?.rollback();
  }, []);

  const abort = useCallback(() => {
    sessionRef.current?.abort();
  }, []);

  const clearStaged = useCallback(async (): Promise<void> => {
    await sessionRef.current?.clearStaged();
  }, []);

  useEffect(() => {
    const session = sessionRef.current;
    return () => {
      void session?.rollback();
    };
  }, []);

  return useMemo(
    () => ({
      stage,
      kickOff: stage,
      resolve,
      markCommitted,
      rollback,
      abort,
      prefetch,
      clearStaged,
    }),
    [stage, resolve, markCommitted, rollback, abort, prefetch, clearStaged]
  );
}
