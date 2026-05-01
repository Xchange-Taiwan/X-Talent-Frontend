'use client';
import { useEffect, useState } from 'react';

import { getUserTags } from '@/services/userTags/getUserTags';
import type { TagIntent, TagKind, UserTag } from '@/services/userTags/types';

interface Options {
  userId: number;
  kind?: TagKind;
  intent?: TagIntent;
  enabled?: boolean;
}

export interface UseUserTagsResult {
  tags: UserTag[];
  isLoading: boolean;
  error: string | null;
}

export function useUserTags({
  userId,
  kind,
  intent,
  enabled = true,
}: Options): UseUserTagsResult {
  const [tags, setTags] = useState<UserTag[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isUserIdValid = Boolean(userId) && !Number.isNaN(userId);
    if (!enabled || !isUserIdValid) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    getUserTags({ userId, kind, intent, signal: controller.signal })
      .then((result) => {
        if (cancelled) return;
        setTags(result);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === 'AbortError') return;
        console.error('Failed to load user tags:', e);
        setError('Failed to load user tags');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [userId, kind, intent, enabled]);

  return { tags, isLoading, error };
}
