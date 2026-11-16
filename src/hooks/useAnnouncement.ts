'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAsyncRead } from '@/hooks/useAsyncRead';
import { AsyncReadManager } from '@/lib/asyncReadManager';
import {
  type AnnouncementData,
  fetchAnnouncement,
  getMaintenanceTimeRemaining,
  isMaintenanceExpired,
} from '@/services/announcement';

const DISMISSED_STORAGE_KEY = 'announcement-dismissed';
const MAX_SET_TIMEOUT_DELAY_MS = 2147483647;

export const ANNOUNCEMENT_CACHE_TTL_MS = 5 * 60 * 1000;

export const announcementReadManager = new AsyncReadManager<
  string,
  AnnouncementData | null
>({
  ttlMs: ANNOUNCEMENT_CACHE_TTL_MS,
});

function readSessionDismissed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.sessionStorage.getItem(DISMISSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeSessionDismissed(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(DISMISSED_STORAGE_KEY, 'true');
  } catch {
    // Ignore SecurityError / QuotaExceededError in storage-restricted contexts
  }
}

export function useAnnouncement() {
  const [hasMounted, setHasMounted] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [expiredMaintenanceTime, setExpiredMaintenanceTime] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (readSessionDismissed()) {
      setDismissed(true);
    }
    setHasMounted(true);
  }, []);

  const { data, isLoading, error } = useAsyncRead(
    announcementReadManager,
    hasMounted && !dismissed ? 'global' : null,
    (signal) => fetchAnnouncement(signal)
  );

  useEffect(() => {
    if (dismissed || !data || !data.enabled || !data.message) {
      return;
    }

    const now = Date.now();
    if (isMaintenanceExpired(data, now)) {
      if (data.maintenanceTime) {
        setExpiredMaintenanceTime(data.maintenanceTime);
      }
      return;
    }

    const timeRemaining = getMaintenanceTimeRemaining(data, now);
    if (timeRemaining <= 0 || timeRemaining > MAX_SET_TIMEOUT_DELAY_MS) {
      return;
    }

    const targetMaintenanceTime = data.maintenanceTime;
    const timer = setTimeout(() => {
      setExpiredMaintenanceTime(targetMaintenanceTime);
    }, timeRemaining);

    return () => {
      clearTimeout(timer);
    };
  }, [data, dismissed]);

  const isExpired =
    Boolean(
      data?.maintenanceTime && expiredMaintenanceTime === data.maintenanceTime
    ) || isMaintenanceExpired(data);

  const visible = Boolean(
    hasMounted &&
    !dismissed &&
    data &&
    data.enabled &&
    data.message &&
    !isExpired
  );

  const handleDismiss = useCallback(() => {
    writeSessionDismissed();
    setDismissed(true);
  }, []);

  return { visible, data, handleDismiss, isLoading, error };
}
