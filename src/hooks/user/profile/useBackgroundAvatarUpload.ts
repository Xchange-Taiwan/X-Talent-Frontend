'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef } from 'react';

import {
  type AvatarUploadSession,
  createAvatarUploadSession,
} from '@/services/profile/avatarUploadSession';

export interface UseBackgroundAvatarUpload {
  stage: (file: File, currentAvatarUrl: string | null | undefined) => void;
  kickOff: (file: File, currentAvatarUrl: string | null | undefined) => void;
  resolve: (file: File | undefined) => Promise<string | undefined>;
  markCommitted: () => void;
  consume: (file: File | undefined) => Promise<string | undefined>;
  rollback: () => Promise<void>;
  abort: () => void;
  prefetch: (targetUserId?: number) => void;
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
 * upload session instance, user identity resolution, and automatic unmount
 * rollback cleanup.
 *
 * Retains compatibility `consume` and optional `explicitUserId` signature
 * until callers adopt two-phase `resolve` + `markCommitted` in #943.
 */
export function useBackgroundAvatarUpload(
  explicitUserId?: number | string | null
): UseBackgroundAvatarUpload {
  const { data: sessionData } = useSession();

  const resolvedUserId =
    explicitUserId !== undefined
      ? normalizeNumericUserId(explicitUserId)
      : normalizeNumericUserId(sessionData?.user?.id);

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

  const consume = useCallback(
    async (file: File | undefined): Promise<string | undefined> => {
      if (!file || !sessionRef.current) return undefined;
      const uploadedUrl = await sessionRef.current.resolve(file);
      sessionRef.current.markCommitted();
      return uploadedUrl;
    },
    []
  );

  const rollback = useCallback(async (): Promise<void> => {
    await sessionRef.current?.rollback();
  }, []);

  const abort = useCallback(() => {
    sessionRef.current?.abort();
  }, []);

  useEffect(() => {
    const session = sessionRef.current;
    return () => {
      void session?.rollback();
    };
  }, []);

  return {
    stage,
    kickOff: stage,
    resolve,
    markCommitted,
    consume,
    rollback,
    abort,
    prefetch,
  };
}
