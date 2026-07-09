'use client';

// Some iOS WebKit browsers (Safari, and every iOS browser — they all share
// the same engine) occasionally dispatch two click events for a single tap
// on an anchor. When both reach the same next/link, App Router's history
// logic (HistoryUpdater in next/dist/client/components/app-router.js)
// pushes a history entry for the first navigation, then treats the second
// push to the now-current URL as a no-op and replaces it instead — silently
// dropping the entry that should exist for the page the user tapped from.
// A single "back" then skips over it. Swallowing the duplicate click here,
// before it reaches React/Link, stops the second navigation from ever
// firing. Mounted once in Providers so it covers every link in the app.
import { useEffect } from 'react';

const DUPLICATE_CLICK_WINDOW_MS = 700;

export default function NavigationClickGuard() {
  useEffect(() => {
    let lastHref: string | null = null;
    let lastTime = 0;

    function handleClick(event: MouseEvent): void {
      if (event.defaultPrevented) return;
      if (!(event.target instanceof Element)) return;

      const anchor = event.target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const href = anchor.href;
      const now = Date.now();

      if (href === lastHref && now - lastTime < DUPLICATE_CLICK_WINDOW_MS) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      lastHref = href;
      lastTime = now;
    }

    document.addEventListener('click', handleClick, { capture: true });
    return () =>
      document.removeEventListener('click', handleClick, { capture: true });
  }, []);

  return null;
}
