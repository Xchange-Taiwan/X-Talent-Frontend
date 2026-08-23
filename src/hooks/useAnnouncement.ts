'use client';

import { useEffect, useState } from 'react';

import { useAsyncRead } from '@/hooks/useAsyncRead';
import { AsyncReadManager } from '@/lib/asyncReadManager';
import { createKeyedCache } from '@/lib/createKeyedCache';
import {
  AnnouncementData,
  fetchAnnouncement,
  getMaintenanceTimeRemaining,
  isMaintenanceExpired,
} from '@/services/announcement';

const DISMISSED_STORAGE_KEY = 'announcement-dismissed';

export const announcementCache = createKeyedCache<
  string,
  AnnouncementData | null
>();
export const announcementReadManager = new AsyncReadManager<
  string,
  AnnouncementData | null
>(announcementCache);

export function useAnnouncement() {
  const [hasMounted, setHasMounted] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    setHasMounted(true);
    if (typeof window !== 'undefined') {
      const isDismissed =
        sessionStorage.getItem(DISMISSED_STORAGE_KEY) === 'true';
      if (isDismissed) {
        setDismissed(true);
      }
    }
  }, []);

  const { data, isLoading, error } = useAsyncRead(
    announcementReadManager,
    hasMounted && !dismissed ? 'global' : null,
    (signal) => fetchAnnouncement(signal)
  );

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (dismissed || !data || !data.enabled || !data.message) {
      setVisible(false);
      return;
    }

    const now = Date.now();
    const isExpired = isMaintenanceExpired(data, now);
    const timeRemaining = getMaintenanceTimeRemaining(data, now);

    // If maintenance time has already passed, don't show
    if (isExpired) {
      setVisible(false);
      return;
    }

    setVisible(true);

    // Set a timeout to automatically hide when maintenance time starts
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (timeRemaining > 0 && timeRemaining <= 2147483647) {
      timer = setTimeout(() => {
        setVisible(false);
      }, timeRemaining);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [data, dismissed]);

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_STORAGE_KEY, 'true');
    setDismissed(true);
    setVisible(false);
  };

  return { visible, data, handleDismiss, isLoading, error };
}
