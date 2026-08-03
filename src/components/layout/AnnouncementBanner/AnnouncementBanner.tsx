'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface AnnouncementData {
  enabled: boolean;
  message: string;
  maintenanceTime: string;
}

export function AnnouncementBanner(): JSX.Element | null {
  const [data, setData] = useState<AnnouncementData | null>(null);
  const [visible, setVisible] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Check session-level dismissal first
    const dismissed =
      sessionStorage.getItem('announcement-dismissed') === 'true';
    if (dismissed) {
      return;
    }

    // 2. Fetch config from our API route
    fetch('/api/announcement')
      .then((res) => {
        if (res.ok) {
          return res.json() as Promise<AnnouncementData>;
        }
        throw new Error('Failed to fetch announcement');
      })
      .then((announcement) => {
        if (!announcement || !announcement.enabled || !announcement.message) {
          return;
        }

        // 3. Check if maintenance time has already passed
        if (announcement.maintenanceTime) {
          const maintenanceDate = new Date(announcement.maintenanceTime);
          if (
            !isNaN(maintenanceDate.getTime()) &&
            Date.now() >= maintenanceDate.getTime()
          ) {
            return;
          }
        }

        setData(announcement);
        setVisible(true);
      })
      .catch((err) => {
        console.error('Error fetching announcement:', err);
      });
  }, []);

  // 4. Update the CSS variable --banner-height when visibility or height changes
  useEffect(() => {
    if (!visible || !bannerRef.current) {
      document.documentElement.style.setProperty('--banner-height', '0px');
      return;
    }

    const updateHeight = () => {
      if (bannerRef.current) {
        const height = bannerRef.current.getBoundingClientRect().height;
        document.documentElement.style.setProperty(
          '--banner-height',
          `${height}px`
        );
      }
    };

    updateHeight();

    // Observe size changes (e.g., text wrapping on viewport resize)
    const observer = new ResizeObserver(updateHeight);
    observer.observe(bannerRef.current);

    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty('--banner-height', '0px');
    };
  }, [visible]);

  const handleDismiss = () => {
    sessionStorage.setItem('announcement-dismissed', 'true');
    setVisible(false);
  };

  if (!visible || !data) {
    return null;
  }

  return (
    <div
      ref={bannerRef}
      className="fixed inset-x-0 top-0 z-[60] flex w-full items-center justify-between gap-4 border-b border-status-warning-default/20 bg-status-warning-default/10 px-5 py-3 text-sm text-text-primary transition-all"
      role="alert"
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="size-5 shrink-0 text-status-warning-default" />
        <span className="font-['Open_Sans'] font-medium leading-relaxed">
          {data.message}
        </span>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded-full p-1 text-text-secondary transition-colors hover:bg-status-warning-default/20 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label="關閉公告"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
