'use client';

import { useEffect, useState } from 'react';

import { AnnouncementData, fetchAnnouncement } from '@/services/announcement';

export function useAnnouncement() {
  const [data, setData] = useState<AnnouncementData | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 1. Check session storage synchronously
    const dismissed =
      sessionStorage.getItem('announcement-dismissed') === 'true';
    if (dismissed) {
      return;
    }

    // 2. Fetch using our service
    fetchAnnouncement()
      .then((announcement) => {
        if (!announcement || !announcement.enabled || !announcement.message) {
          return;
        }

        const now = Date.now();
        let isExpired = false;
        let timeRemaining = 0;

        if (announcement.maintenanceTime) {
          const maintenanceDate = new Date(announcement.maintenanceTime);
          if (!isNaN(maintenanceDate.getTime())) {
            timeRemaining = maintenanceDate.getTime() - now;
            isExpired = timeRemaining <= 0;
          }
        }

        // If maintenance time has already passed, don't show
        if (isExpired) {
          return;
        }

        setData(announcement);
        setVisible(true);

        // 3. Set a timeout to automatically hide when maintenance time starts
        if (timeRemaining > 0) {
          const timer = setTimeout(() => {
            setVisible(false);
          }, timeRemaining);
          return () => clearTimeout(timer);
        }
      })
      .catch((err) => {
        console.error('Error in useAnnouncement:', err);
      });
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem('announcement-dismissed', 'true');
    setVisible(false);
  };

  return { visible, data, handleDismiss };
}
