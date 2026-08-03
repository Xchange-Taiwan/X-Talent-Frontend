'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useRef } from 'react';

import { useAnnouncement } from '@/hooks/useAnnouncement';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';

export function AnnouncementBanner(): JSX.Element | null {
  const { visible, data, handleDismiss } = useAnnouncement();
  const bannerRef = useRef<HTMLDivElement>(null);

  // Update the CSS variable --banner-height when visibility or height changes
  useIsomorphicLayoutEffect(() => {
    if (!visible || !bannerRef.current) {
      document.documentElement.style.setProperty('--banner-height', '0px');
      return;
    }

    const updateHeight = (height: number) => {
      document.documentElement.style.setProperty(
        '--banner-height',
        `${height}px`
      );
    };

    // Observe size changes (e.g., text wrapping on viewport resize).
    // ResizeObserver fires once on observe() before the next paint, so no
    // manual initial measurement is needed here.
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        // borderBoxSize includes padding/border; contentRect does not (it
        // would under-report this banner's height by its py-3 + border-b).
        // Falling back to offsetHeight (not contentRect) keeps that same
        // border-box measurement on browsers without borderBoxSize support.
        const height =
          entry.borderBoxSize?.[0]?.blockSize ??
          (entry.target as HTMLElement).offsetHeight;
        if (height !== undefined) {
          updateHeight(height);
        }
      }
    });

    observer.observe(bannerRef.current);

    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty('--banner-height', '0px');
    };
  }, [visible]);

  if (!visible || !data) {
    return null;
  }

  return (
    // Opaque outer layer — the warning tint below is translucent, so without
    // this backing, page content scrolling underneath the fixed banner would
    // show through it.
    <div
      ref={bannerRef}
      className="fixed inset-x-0 top-0 z-[60] w-full border-b border-status-warning-default/20 bg-light"
      role="alert"
    >
      <div className="flex w-full items-center justify-between gap-4 bg-status-warning-default/10 px-5 py-3 text-sm text-text-primary">
        <div className="flex items-center gap-3">
          <AlertTriangle className="size-5 shrink-0 text-status-warning-default" />
          <span className="font-['Open_Sans'] leading-relaxed font-medium">
            {data.message}
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-full p-1 text-text-secondary transition-colors hover:bg-status-warning-default/20 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
          aria-label="關閉公告"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
