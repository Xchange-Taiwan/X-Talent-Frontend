'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UnsavedChangesPrompt {
  isPromptOpen: boolean;
  confirmLeave: () => void;
  cancelLeave: () => void;
  guardNavigate: (action: () => void) => void;
}

// Guards a long-form page against accidental navigation while `when` is true.
// Covers three exit paths:
//   1. Browser unload (tab close, refresh, external URL) via `beforeunload`.
//   2. SPA <Link>/<a> clicks via document-level capture; replayed through
//      router.push on confirm. App Router has no routeChangeStart hook, so
//      this is the only place we can catch them.
//   3. Browser back/forward via popstate; we re-push the current URL so the
//      user "stays", then on confirm flip a leaving flag and call
//      history.back() once more so the popstate fires through cleanly.
export function useUnsavedChangesPrompt(when: boolean): UnsavedChangesPrompt {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const whenRef = useRef(when);
  const isLeavingRef = useRef(false);

  useEffect(() => {
    whenRef.current = when;
  }, [when]);

  useEffect(() => {
    if (!when) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [when]);

  useEffect(() => {
    if (!when) return;
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.('a');
      if (!anchor) return;
      const target = anchor.getAttribute('target');
      if (target && target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      let url: URL;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }
      // External origins fall through to beforeunload.
      if (url.origin !== window.location.origin) return;

      const dest = url.pathname + url.search + url.hash;
      e.preventDefault();
      e.stopPropagation();
      setPendingAction(() => () => router.push(dest));
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [when, router]);

  useEffect(() => {
    if (!when) return;
    const handler = () => {
      if (isLeavingRef.current) {
        isLeavingRef.current = false;
        return;
      }
      window.history.pushState(null, '', window.location.href);
      setPendingAction(() => () => {
        isLeavingRef.current = true;
        window.history.back();
      });
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [when]);

  const confirmLeave = useCallback(() => {
    const action = pendingAction;
    setPendingAction(null);
    action?.();
  }, [pendingAction]);

  const cancelLeave = useCallback(() => {
    setPendingAction(null);
  }, []);

  const guardNavigate = useCallback((action: () => void) => {
    if (whenRef.current) {
      setPendingAction(() => action);
    } else {
      action();
    }
  }, []);

  return {
    isPromptOpen: pendingAction !== null,
    confirmLeave,
    cancelLeave,
    guardNavigate,
  };
}
