import * as React from 'react';

import { safeGetStorage, safeSetStorage } from '@/lib/storage';

/**
 * Reusable custom hook to manage seen notifications count state, localStorage persistence,
 * and multi-instance (Desktop/Mobile) / cross-tab synchronization.
 */
export function usePersistedSeenCount(
  storageKey: string,
  unreadCount: number,
  status: string
) {
  // Initialize synchronously to 0 to prevent Next.js SSR Hydration Mismatch.
  // The state will be populated correctly on mount by the useEffect block below.
  const [seenUnreadCount, setSeenUnreadCount] = React.useState<number>(0);
  const [isMounted, setIsMounted] = React.useState(false);

  // Helper to read and safely parse value from localStorage
  const getStoredSeenCount = React.useCallback((key: string): number => {
    const stored = safeGetStorage(key);
    const parsed = stored !== null ? Number(stored) : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  }, []);

  // Helper to write to localStorage and dispatch custom update event to other instances
  const writeAndNotifySeen = React.useCallback(
    (val: number) => {
      safeSetStorage(storageKey, String(val));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('notif_seen_updated', {
            detail: { storageKey, seenCount: val },
          })
        );
      }
    },
    [storageKey]
  );

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync seenUnreadCount from localStorage when storageKey (userId) changes or on mount.
  React.useEffect(() => {
    setSeenUnreadCount(getStoredSeenCount(storageKey));
  }, [storageKey, getStoredSeenCount]);

  // Keep seenUnreadCount clamped to unreadCount to prevent stale values,
  // but only when we are not in a loading status to avoid accidental cache overwriting during API load.
  React.useEffect(() => {
    if (status !== 'loading' && seenUnreadCount > unreadCount) {
      setSeenUnreadCount(unreadCount);
      writeAndNotifySeen(unreadCount);
    }
  }, [unreadCount, seenUnreadCount, writeAndNotifySeen, status]);

  // Synchronize state across multiple instances (e.g. desktop vs mobile notification bells in Header) and browser tabs
  React.useEffect(() => {
    const handleCustomSync = (e: Event) => {
      const customEvent = e as CustomEvent<{
        storageKey: string;
        seenCount: number;
      }>;
      if (customEvent.detail && customEvent.detail.storageKey === storageKey) {
        setSeenUnreadCount(customEvent.detail.seenCount);
      }
    };

    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === storageKey) {
        const val = e.newValue !== null ? Number(e.newValue) : 0;
        setSeenUnreadCount(Number.isNaN(val) ? 0 : val);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageSync as EventListener);
      window.addEventListener('notif_seen_updated', handleCustomSync);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(
          'storage',
          handleStorageSync as EventListener
        );
        window.removeEventListener('notif_seen_updated', handleCustomSync);
      }
    };
  }, [storageKey]);

  return {
    seenUnreadCount,
    setSeenUnreadCount,
    isMounted,
    writeAndNotifySeen,
  };
}
