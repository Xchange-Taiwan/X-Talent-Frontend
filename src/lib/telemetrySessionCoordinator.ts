// Framework-free TelemetrySessionCoordinator (X-Tracker #979).
//
// Owns the single session state machine that feeds GA4 / Clarity (Analytics
// sink) and Sentry (Sentry sink), so the identity bind always lands before the
// first deferred `page_view` regardless of React effect or JSX mount order.
// It also owns the `/profile/[id]` `document.title` masking state machine.
//
// Zero React / Next / DOM globals: every side effect goes through an injected
// port. `src/components/PageViewTracker.tsx` is the only React/DOM adapter.

import {
  type AnalyticsUserRole,
  isUserProfilePath,
  sanitizeAnalyticsUserId,
} from '@/lib/analytics';
import { sanitizeSentryUserId } from '@/lib/sentrySanitize';

export const INITIAL_SESSION_RESOLVE_TIMEOUT_MS = 1500;

export type TelemetrySessionStatus =
  'loading' | 'authenticated' | 'unauthenticated';

/** Minimal, PII-free projection of the NextAuth session the coordinator reads. */
export interface TelemetrySessionSnapshot {
  status: TelemetrySessionStatus;
  userId?: string | number | null;
  isMentor?: boolean | null;
  error?: string | null;
}

export interface TelemetryIdentity {
  userId: string | null;
  userRole: AnalyticsUserRole;
}

export interface TelemetryPageViewOptions {
  title?: string;
}

/** GA4 / Clarity port (`setAnalyticsUserContext` + `trackPageView`). */
export interface TelemetryAnalyticsSink {
  setUserContext(identity: TelemetryIdentity): void;
  trackPageView(path: string, options?: TelemetryPageViewOptions): void;
}

/** Sentry scope port (`Sentry.setUser` + `Sentry.setTag`). */
export interface TelemetrySentrySink {
  setUser(user: { id: string } | null): void;
  setUserRoleTag(userRole: AnalyticsUserRole): void;
}

/** Read-only view of the live document the adapter exposes to the coordinator. */
export interface TelemetryDocumentPort {
  readTitle(): string;
  /** Live browser pathname (may lead the router pathname during SPA commits). */
  readLivePathname(): string | null;
  readSearch(): string;
}

export interface TelemetryScheduler {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export type TelemetrySinkName = 'analytics' | 'sentry';

export type TelemetrySinkOperation =
  'setUserContext' | 'trackPageView' | 'setUser' | 'setUserRoleTag';

/**
 * Error contract for sink failures. A failing sink never blocks the other sink
 * or the page_view pipeline; the adapter decides how to report it.
 */
export interface TelemetrySinkFailure {
  sink: TelemetrySinkName;
  operation: TelemetrySinkOperation;
  error: unknown;
}

export interface TelemetrySessionCoordinatorPorts {
  analytics: TelemetryAnalyticsSink;
  sentry: TelemetrySentrySink;
  document: TelemetryDocumentPort;
  scheduler?: TelemetryScheduler;
  onSinkFailure?: (failure: TelemetrySinkFailure) => void;
  sessionResolveTimeoutMs?: number;
}

export interface TelemetrySessionCoordinatorState {
  sessionStatus: TelemetrySessionStatus | null;
  sessionTimedOut: boolean;
  isSessionReady: boolean;
  identity: TelemetryIdentity | null;
  currentPathname: string | null;
  lastTrackedPathname: string | null;
}

export interface TelemetrySessionCoordinator {
  /** Feed the latest session; binds identity first, then flushes a deferred page_view. */
  updateSession(snapshot: TelemetrySessionSnapshot): void;
  /** Router pathname committed; observes the title and emits page_view once ready. */
  enterRoute(pathname: string | null): void;
  /** Router is leaving `pathname`; captures the last profile title for masking. */
  leaveRoute(pathname: string | null): void;
  /** `<title>` mutated (sync or streamed); updates the masking state machine. */
  observeTitle(): void;
  /** Cancels the pending session-resolve timer (adapter unmount). Re-armed by `updateSession`. */
  dispose(): void;
  getState(): TelemetrySessionCoordinatorState;
}

const GUEST_IDENTITY: TelemetryIdentity = { userId: null, userRole: 'guest' };

/**
 * Resolves the telemetry identity for a session snapshot under the strict
 * opaque-ID rule shared by GA4 and Sentry. Returns `null` while the session is
 * still loading (no identity mutation), except for `RefreshTokenError`, which
 * clears immediately even if a stale `user.id` is still present.
 */
export function resolveTelemetryIdentity(
  snapshot: TelemetrySessionSnapshot
): TelemetryIdentity | null {
  if (snapshot.error === 'RefreshTokenError') {
    return GUEST_IDENTITY;
  }
  if (snapshot.status === 'loading') {
    return null;
  }
  if (snapshot.status === 'authenticated') {
    const analyticsId = sanitizeAnalyticsUserId(snapshot.userId);
    const sentryId = sanitizeSentryUserId(snapshot.userId);
    if (analyticsId && sentryId === analyticsId) {
      return {
        userId: analyticsId,
        userRole: snapshot.isMentor ? 'mentor' : 'mentee',
      };
    }
  }
  return GUEST_IDENTITY;
}

function identityKey(identity: TelemetryIdentity): string {
  return `${identity.userId ?? 'null'}|${identity.userRole}`;
}

const globalScheduler: TelemetryScheduler = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) =>
    globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createTelemetrySessionCoordinator(
  ports: TelemetrySessionCoordinatorPorts
): TelemetrySessionCoordinator {
  const scheduler = ports.scheduler ?? globalScheduler;
  const timeoutMs =
    ports.sessionResolveTimeoutMs ?? INITIAL_SESSION_RESOLVE_TIMEOUT_MS;

  let sessionStatus: TelemetrySessionStatus | null = null;
  let sessionTimedOut = false;
  let timeoutHandle: unknown = null;
  let identity: TelemetryIdentity | null = null;
  let appliedIdentityKey: string | null = null;

  let currentPathname: string | null = null;
  let lastTrackedPathname: string | null = null;
  let lastProfileTitle: string | null = null;
  let lastNonProfileTitle: string | null = null;

  function runSink(
    sink: TelemetrySinkName,
    operation: TelemetrySinkOperation,
    effect: () => void
  ): void {
    try {
      effect();
    } catch (error) {
      try {
        ports.onSinkFailure?.({ sink, operation, error });
      } catch {
        // A broken reporter must never break the telemetry pipeline.
      }
    }
  }

  function isSessionReady(): boolean {
    return (
      sessionStatus !== null && (sessionStatus !== 'loading' || sessionTimedOut)
    );
  }

  function clearSessionTimer(): void {
    if (timeoutHandle !== null) {
      scheduler.clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
  }

  function armSessionTimer(): void {
    if (
      sessionStatus !== 'loading' ||
      sessionTimedOut ||
      timeoutHandle !== null
    ) {
      return;
    }
    timeoutHandle = scheduler.setTimeout(() => {
      timeoutHandle = null;
      sessionTimedOut = true;
      flushPageView();
    }, timeoutMs);
  }

  function applyIdentity(next: TelemetryIdentity): void {
    const key = identityKey(next);
    if (key === appliedIdentityKey) return;
    appliedIdentityKey = key;
    identity = next;

    runSink('analytics', 'setUserContext', () =>
      ports.analytics.setUserContext(next)
    );
    runSink('sentry', 'setUser', () =>
      ports.sentry.setUser(next.userId ? { id: next.userId } : null)
    );
    runSink('sentry', 'setUserRoleTag', () =>
      ports.sentry.setUserRoleTag(next.userRole)
    );
  }

  function observeTitle(): void {
    const livePathname = ports.document.readLivePathname() || currentPathname;
    if (!livePathname) return;
    const nextTitle = ports.document.readTitle();
    if (!nextTitle) return;

    if (isUserProfilePath(livePathname)) {
      if (nextTitle !== lastNonProfileTitle) {
        lastProfileTitle = nextTitle;
      }
    } else if (nextTitle !== lastProfileTitle) {
      lastNonProfileTitle = nextTitle;
    }
  }

  function flushPageView(): void {
    const pathname = currentPathname;
    if (!pathname || !isSessionReady() || lastTrackedPathname === pathname) {
      return;
    }

    const previousPath = lastTrackedPathname;
    lastTrackedPathname = pathname;

    const currentTitle = ports.document.readTitle();
    const isNowProfile = isUserProfilePath(pathname);
    const wasPrevProfile = previousPath
      ? isUserProfilePath(previousPath)
      : false;

    if (isNowProfile) {
      if (
        previousPath === null ||
        (currentTitle && currentTitle !== lastNonProfileTitle)
      ) {
        lastProfileTitle = currentTitle || lastProfileTitle;
      } else if (!wasPrevProfile) {
        lastProfileTitle = null;
      }
    }

    const hasStaleProfileTitle =
      !isNowProfile &&
      wasPrevProfile &&
      Boolean(currentTitle) &&
      currentTitle === lastProfileTitle;

    if (!isNowProfile) {
      if (!hasStaleProfileTitle && currentTitle) {
        lastNonProfileTitle = currentTitle;
      }
      lastProfileTitle = null;
    }

    const path = `${pathname}${ports.document.readSearch()}`;
    runSink('analytics', 'trackPageView', () =>
      ports.analytics.trackPageView(
        path,
        hasStaleProfileTitle ? { title: '' } : undefined
      )
    );
  }

  return {
    updateSession(snapshot) {
      sessionStatus = snapshot.status;
      if (snapshot.status === 'loading') {
        armSessionTimer();
      } else {
        clearSessionTimer();
      }

      const next = resolveTelemetryIdentity(snapshot);
      if (next) {
        applyIdentity(next);
      }
      // Identity is bound above before any deferred page_view is released.
      flushPageView();
    },

    enterRoute(pathname) {
      currentPathname = pathname;
      if (!pathname) return;
      observeTitle();
      flushPageView();
    },

    leaveRoute(pathname) {
      if (!pathname || !isUserProfilePath(pathname)) return;
      const title = ports.document.readTitle();
      if (title && title !== lastNonProfileTitle) {
        lastProfileTitle = title;
      }
    },

    observeTitle,

    dispose() {
      clearSessionTimer();
    },

    getState() {
      return {
        sessionStatus,
        sessionTimedOut,
        isSessionReady: isSessionReady(),
        identity,
        currentPathname,
        lastTrackedPathname,
      };
    },
  };
}
