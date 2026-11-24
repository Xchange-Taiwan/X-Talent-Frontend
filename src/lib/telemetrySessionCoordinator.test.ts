import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createTelemetrySessionCoordinator,
  INITIAL_SESSION_RESOLVE_TIMEOUT_MS,
  resolveTelemetryIdentity,
  type TelemetryIdentity,
  type TelemetryPageViewOptions,
  type TelemetrySessionCoordinatorPorts,
  type TelemetrySinkFailure,
} from './telemetrySessionCoordinator';

type SinkCall =
  | { sink: 'analytics.setUserContext'; identity: TelemetryIdentity }
  | {
      sink: 'analytics.trackPageView';
      path: string;
      options?: TelemetryPageViewOptions;
    }
  | { sink: 'sentry.setUser'; user: { id: string } | null }
  | { sink: 'sentry.setUserRoleTag'; userRole: string };

function createHarness(
  overrides: Partial<TelemetrySessionCoordinatorPorts> = {}
) {
  const calls: SinkCall[] = [];
  const doc = {
    title: 'X-Talent 首頁',
    livePathname: '/' as string | null,
    search: '',
  };
  const failures: TelemetrySinkFailure[] = [];

  const ports: TelemetrySessionCoordinatorPorts = {
    analytics: {
      setUserContext: (identity) =>
        calls.push({ sink: 'analytics.setUserContext', identity }),
      trackPageView: (pagePath, options) =>
        calls.push({
          sink: 'analytics.trackPageView',
          path: pagePath,
          options,
        }),
    },
    sentry: {
      setUser: (user) => calls.push({ sink: 'sentry.setUser', user }),
      setUserRoleTag: (userRole) =>
        calls.push({ sink: 'sentry.setUserRoleTag', userRole }),
    },
    document: {
      readTitle: () => doc.title,
      readLivePathname: () => doc.livePathname,
      readSearch: () => doc.search,
    },
    onSinkFailure: (failure) => failures.push(failure),
    ...overrides,
  };

  const coordinator = createTelemetrySessionCoordinator(ports);

  /** Mirrors the adapter: leave old route, commit new pathname + live URL. */
  function navigate(pathname: string, title?: string) {
    coordinator.leaveRoute(coordinator.getState().currentPathname);
    doc.livePathname = pathname;
    if (title !== undefined) doc.title = title;
    coordinator.enterRoute(pathname);
  }

  const pageViews = () =>
    calls.filter(
      (c): c is Extract<SinkCall, { sink: 'analytics.trackPageView' }> =>
        c.sink === 'analytics.trackPageView'
    );

  return { calls, coordinator, doc, failures, navigate, pageViews };
}

describe('telemetrySessionCoordinator module boundary', () => {
  it('has zero React / Next / DOM global dependencies', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, 'telemetrySessionCoordinator.ts'),
      'utf8'
    );
    const code = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');

    expect(code).not.toMatch(/from ['"]react['"]/);
    expect(code).not.toMatch(/from ['"]next(?:\/|-auth|['"])/);
    expect(code).not.toMatch(/from ['"]@sentry\//);
    expect(code).not.toMatch(/\bwindow\./);
    expect(code).not.toMatch(/\bdocument\.(?:title|head|location)/);
    expect(code).not.toMatch(/\bMutationObserver\b/);
    expect(typeof window).toBe('undefined');
  });
});

describe('resolveTelemetryIdentity', () => {
  it('returns null while loading and clears immediately on RefreshTokenError', () => {
    expect(resolveTelemetryIdentity({ status: 'loading' })).toBeNull();
    expect(
      resolveTelemetryIdentity({
        status: 'loading',
        userId: '999998',
        error: 'RefreshTokenError',
      })
    ).toEqual({ userId: null, userRole: 'guest' });
    expect(
      resolveTelemetryIdentity({
        status: 'authenticated',
        userId: '999998',
        isMentor: true,
        error: 'RefreshTokenError',
      })
    ).toEqual({ userId: null, userRole: 'guest' });
  });

  it('maps authenticated opaque IDs to mentor / mentee and unauthenticated to guest even with a stale user.id', () => {
    expect(
      resolveTelemetryIdentity({
        status: 'authenticated',
        userId: '777001',
        isMentor: false,
      })
    ).toEqual({ userId: '777001', userRole: 'mentee' });
    expect(
      resolveTelemetryIdentity({
        status: 'authenticated',
        userId: 'user_42',
        isMentor: true,
      })
    ).toEqual({ userId: 'user_42', userRole: 'mentor' });
    expect(
      resolveTelemetryIdentity({
        status: 'unauthenticated',
        userId: '777001',
        isMentor: true,
      })
    ).toEqual({ userId: null, userRole: 'guest' });
  });

  it.each([
    'null',
    'undefined',
    '0',
    'guest',
    'NaN',
    'leaked.user@example.com',
    'person@example.com',
    'Alice Chen',
    '王小明',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig',
    'mock-access-token',
    '',
  ])(
    'rejects sentinel / PII-tainted id %j and falls back to guest',
    (unsafeId) => {
      expect(
        resolveTelemetryIdentity({
          status: 'authenticated',
          userId: unsafeId,
          isMentor: true,
        })
      ).toEqual({ userId: null, userRole: 'guest' });
    }
  );
});

describe('createTelemetrySessionCoordinator: identity sync', () => {
  it('does not touch GA4 or Sentry while the session is loading', () => {
    const { calls, coordinator } = createHarness();
    coordinator.updateSession({ status: 'loading' });
    expect(calls).toEqual([]);
    expect(coordinator.getState().identity).toBeNull();
    coordinator.dispose();
  });

  it('binds the same sanitized identity to GA4 and Sentry without PII and clears both on logout', () => {
    const { calls, coordinator } = createHarness();

    coordinator.updateSession({
      status: 'authenticated',
      userId: '999998',
      isMentor: true,
    });

    expect(calls).toEqual([
      {
        sink: 'analytics.setUserContext',
        identity: { userId: '999998', userRole: 'mentor' },
      },
      { sink: 'sentry.setUser', user: { id: '999998' } },
      { sink: 'sentry.setUserRoleTag', userRole: 'mentor' },
    ]);

    calls.length = 0;
    coordinator.updateSession({ status: 'unauthenticated' });

    expect(calls).toEqual([
      {
        sink: 'analytics.setUserContext',
        identity: { userId: null, userRole: 'guest' },
      },
      { sink: 'sentry.setUser', user: null },
      { sink: 'sentry.setUserRoleTag', userRole: 'guest' },
    ]);
  });

  it('dedupes repeated snapshots (React StrictMode) and re-syncs when isMentor flips', () => {
    const { calls, coordinator } = createHarness();
    const mentee = {
      status: 'authenticated' as const,
      userId: '777001',
      isMentor: false,
    };

    coordinator.updateSession(mentee);
    coordinator.updateSession(mentee);
    expect(
      calls.filter((c) => c.sink === 'analytics.setUserContext')
    ).toHaveLength(1);

    coordinator.updateSession({ ...mentee, isMentor: true });
    expect(calls.at(-3)).toEqual({
      sink: 'analytics.setUserContext',
      identity: { userId: '777001', userRole: 'mentor' },
    });
    expect(calls.at(-1)).toEqual({
      sink: 'sentry.setUserRoleTag',
      userRole: 'mentor',
    });
  });

  it('clears identity on RefreshTokenError even if stale user.id is still present', () => {
    const { calls, coordinator } = createHarness();
    coordinator.updateSession({
      status: 'authenticated',
      userId: '999998',
      isMentor: true,
      error: 'RefreshTokenError',
    });
    expect(calls).toEqual([
      {
        sink: 'analytics.setUserContext',
        identity: { userId: null, userRole: 'guest' },
      },
      { sink: 'sentry.setUser', user: null },
      { sink: 'sentry.setUserRoleTag', userRole: 'guest' },
    ]);
  });

  it('isolates sink failures: a throwing Sentry sink never blocks GA4 identity or page_view and is reported through onSinkFailure', () => {
    const sentryError = new Error('sentry not initialised');
    const { calls, coordinator, failures } = createHarness({
      sentry: {
        setUser: () => {
          throw sentryError;
        },
        setUserRoleTag: () => undefined,
      },
    });

    coordinator.enterRoute('/');
    coordinator.updateSession({
      status: 'authenticated',
      userId: '999998',
      isMentor: false,
    });

    expect(calls.map((c) => c.sink)).toEqual([
      'analytics.setUserContext',
      'analytics.trackPageView',
    ]);
    expect(failures).toEqual([
      { sink: 'sentry', operation: 'setUser', error: sentryError },
    ]);
  });

  it('survives a throwing onSinkFailure reporter', () => {
    const { coordinator, pageViews } = createHarness({
      analytics: {
        setUserContext: () => {
          throw new Error('gtag blocked');
        },
        trackPageView: () => undefined,
      },
      onSinkFailure: () => {
        throw new Error('reporter broken');
      },
    });
    expect(() =>
      coordinator.updateSession({ status: 'unauthenticated' })
    ).not.toThrow();
    expect(pageViews()).toEqual([]);
  });
});

describe('createTelemetrySessionCoordinator: page_view gating', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('binds identity deterministically before the first deferred page_view regardless of call order (#866)', () => {
    for (const order of ['route-first', 'session-first'] as const) {
      const { calls, coordinator, doc } = createHarness();
      doc.livePathname = '/mentor-pool';
      doc.title = '尋找導師 | XChange Talent Pool';

      if (order === 'route-first') {
        coordinator.updateSession({ status: 'loading' });
        coordinator.enterRoute('/mentor-pool');
        expect(calls).toEqual([]);
        coordinator.updateSession({
          status: 'authenticated',
          userId: '999998',
          isMentor: true,
        });
      } else {
        coordinator.updateSession({
          status: 'authenticated',
          userId: '999998',
          isMentor: true,
        });
        coordinator.enterRoute('/mentor-pool');
      }

      expect(calls[0]).toEqual({
        sink: 'analytics.setUserContext',
        identity: { userId: '999998', userRole: 'mentor' },
      });
      expect(calls.at(-1)).toEqual({
        sink: 'analytics.trackPageView',
        path: '/mentor-pool',
        options: undefined,
      });
      expect(
        calls.filter((c) => c.sink === 'analytics.trackPageView')
      ).toHaveLength(1);
    }
  });

  it('never emits page_view before any session snapshot arrives', () => {
    const { coordinator, pageViews } = createHarness();
    coordinator.enterRoute('/');
    vi.advanceTimersByTime(INITIAL_SESSION_RESOLVE_TIMEOUT_MS * 2);
    expect(pageViews()).toEqual([]);
  });

  it('releases the initial page_view after the session-resolve timeout without duplicating once resolved', () => {
    const { coordinator, pageViews } = createHarness();
    coordinator.updateSession({ status: 'loading' });
    coordinator.enterRoute('/');

    vi.advanceTimersByTime(INITIAL_SESSION_RESOLVE_TIMEOUT_MS - 1);
    expect(pageViews()).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(pageViews()).toEqual([
      { sink: 'analytics.trackPageView', path: '/', options: undefined },
    ]);
    expect(coordinator.getState().sessionTimedOut).toBe(true);

    coordinator.updateSession({ status: 'unauthenticated' });
    expect(pageViews()).toHaveLength(1);
  });

  it('dispose cancels the pending timer and the next loading snapshot re-arms it (StrictMode remount)', () => {
    const { coordinator, pageViews } = createHarness();
    coordinator.updateSession({ status: 'loading' });
    coordinator.enterRoute('/');
    coordinator.dispose();

    vi.advanceTimersByTime(INITIAL_SESSION_RESOLVE_TIMEOUT_MS);
    expect(pageViews()).toEqual([]);

    coordinator.updateSession({ status: 'loading' });
    vi.advanceTimersByTime(INITIAL_SESSION_RESOLVE_TIMEOUT_MS);
    expect(pageViews()).toHaveLength(1);
  });

  it('dedupes same-path re-entry and emits on SPA route change with the live query string', () => {
    const { coordinator, doc, navigate, pageViews } = createHarness();
    coordinator.updateSession({ status: 'unauthenticated' });
    coordinator.enterRoute('/');
    coordinator.leaveRoute('/');
    coordinator.enterRoute('/');
    expect(pageViews()).toHaveLength(1);

    doc.search = '?utm_source=digest';
    navigate('/about', '關於我們 | X-Talent');
    expect(pageViews().at(-1)).toEqual({
      sink: 'analytics.trackPageView',
      path: '/about?utm_source=digest',
      options: undefined,
    });
  });
});

describe('createTelemetrySessionCoordinator: /profile/[id] title masking', () => {
  function readyHarness(pathname: string, title: string) {
    const harness = createHarness();
    harness.doc.livePathname = pathname;
    harness.doc.title = title;
    harness.coordinator.updateSession({ status: 'unauthenticated' });
    harness.coordinator.enterRoute(pathname);
    return harness;
  }

  it('masks a stale profile title after hard-load on /profile/[id] then SPA transition before <title> updates', () => {
    const { navigate, pageViews } = readyHarness(
      '/profile/7482008160728084',
      '王小明 | XChange Talent Pool'
    );
    navigate('/mentor-pool');
    expect(pageViews().at(-1)).toEqual({
      sink: 'analytics.trackPageView',
      path: '/mentor-pool',
      options: { title: '' },
    });
  });

  it('masks a title streamed asynchronously while on /profile/[id] (multi-hop /mentor-pool -> /profile -> /about)', () => {
    const { coordinator, doc, navigate, pageViews } = readyHarness(
      '/mentor-pool',
      '尋找導師 | XChange Talent Pool'
    );

    navigate('/profile/7482008160728084');
    expect(pageViews().at(-1)?.path).toBe('/profile/7482008160728084');

    doc.title = '王小明 | XChange Talent Pool';
    coordinator.observeTitle();

    navigate('/about');
    expect(pageViews().at(-1)).toEqual({
      sink: 'analytics.trackPageView',
      path: '/about',
      options: { title: '' },
    });
  });

  it('masks titles committed synchronously across consecutive profile hops', () => {
    const { navigate, pageViews } = readyHarness(
      '/mentor-pool',
      '尋找導師 | XChange Talent Pool'
    );
    navigate('/profile/7482008160728084', '陳小華 | XChange Talent Pool');
    navigate('/profile/7482008160728085');
    navigate('/about');
    expect(pageViews().at(-1)).toEqual({
      sink: 'analytics.trackPageView',
      path: '/about',
      options: { title: '' },
    });
  });

  it('captures the profile title on leaveRoute even when no mutation was observed', () => {
    const { coordinator, doc, navigate, pageViews } = readyHarness(
      '/mentor-pool',
      '尋找導師 | XChange Talent Pool'
    );
    navigate('/profile/7482008160728084');
    // Title streams in without the adapter observing it; leaveRoute captures it.
    doc.title = '林小強 | XChange Talent Pool';
    coordinator.leaveRoute('/profile/7482008160728084');
    coordinator.enterRoute('/about');
    expect(pageViews().at(-1)?.options).toEqual({ title: '' });
  });

  it('does not mask a fresh non-profile title after leaving a profile page', () => {
    const { navigate, pageViews } = readyHarness(
      '/profile/7482008160728084',
      '王小明 | XChange Talent Pool'
    );
    navigate('/about', '關於我們 | X-Talent');
    expect(pageViews().at(-1)).toEqual({
      sink: 'analytics.trackPageView',
      path: '/about',
      options: undefined,
    });
  });
});
