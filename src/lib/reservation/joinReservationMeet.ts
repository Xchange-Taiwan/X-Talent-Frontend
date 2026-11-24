import { upgradeClaritySession } from '@/lib/analytics';
import { ApiError } from '@/lib/apiClient';
import { fetchReservationMeetLink } from '@/services/reservations';

/**
 * Framework-free "join the video meeting" workflow (X-Tracker #978).
 *
 * Owns the whole Meet-join sequence that used to live inside the
 * `useReservationMeetLink` hook:
 *
 * 1. single-flight lock checked BEFORE any placeholder tab is opened, so a
 *    rapid double click never flashes a second `about:blank` tab;
 * 2. placeholder tab opened synchronously (same click task) so popup
 *    blockers still honour the user gesture, with a current-window fallback
 *    when the browser blocks it anyway;
 * 3. strict `new URL()` validation (`https:` + allow-listed video host);
 * 4. `403` / `404` / generic failure classification into toast copy, closing
 *    the placeholder tab and upgrading the Clarity session on every failure.
 *
 * Side effects flow through two ports (`MeetLinkFetcherPort`,
 * `ExternalTabOpenerPort`) with production browser adapters and in-memory
 * test adapters, so the workflow is unit-testable in plain Node.
 */

export const ALLOWED_MEET_HOSTS: readonly string[] = ['meet.google.com'];

export const MEET_LINK_FETCH_FAILED_CLARITY_REASON = 'meet_link_fetch_failed';

/* ================================
 * Ports
 * ================================ */

export interface MeetLinkRequest {
  userId: string | number;
  reservationId: string;
}

export interface MeetLinkFetcherPort {
  fetchMeetUrl(request: MeetLinkRequest): Promise<string | null | undefined>;
}

export interface ExternalTabHandle {
  navigate(url: string): void;
  close(): void;
}

export interface ExternalTabOpenerPort {
  /** Opens an `about:blank` placeholder tab; `null` when the popup is blocked. */
  openPlaceholderTab(): ExternalTabHandle | null;
  /** Fallback used when the placeholder tab could not be opened. */
  navigateCurrentWindow(url: string): void;
}

export interface JoinReservationMeetPorts {
  meetLinkFetcher: MeetLinkFetcherPort;
  tabOpener: ExternalTabOpenerPort;
  upgradeClaritySession: (reason: string) => void;
}

/* ================================
 * Results
 * ================================ */

export type JoinReservationMeetFailureReason =
  | 'unauthenticated'
  | 'missing_link'
  | 'unsafe_link'
  | 'forbidden'
  | 'not_found'
  | 'request_failed';

export interface JoinReservationMeetCopy {
  title: string;
  description: string;
}

export const JOIN_MEET_FAILURE_COPY: Record<
  JoinReservationMeetFailureReason,
  JoinReservationMeetCopy
> = {
  unauthenticated: {
    title: '錯誤',
    description: '無法取得目前使用者資訊，請重新登入。',
  },
  missing_link: {
    title: '找不到會議連結',
    description: '此預約尚未就緒，或會議連結不存在。',
  },
  unsafe_link: {
    title: '錯誤',
    description: '取得會議連結失敗，請稍後再試。',
  },
  forbidden: {
    title: '錯誤',
    description: '您並非此預約的導師或學員，無法加入。',
  },
  not_found: {
    title: '錯誤',
    description: '連結尚未就緒或不存在（會議狀態需為已排程）。',
  },
  request_failed: {
    title: '錯誤',
    description: '取得會議連結失敗，請稍後再試。',
  },
};

export type JoinReservationMeetResult =
  | { status: 'joined'; target: 'new_tab' | 'current_window' }
  | { status: 'skipped'; reason: 'in_flight' }
  | ({
      status: 'failed';
      reason: JoinReservationMeetFailureReason;
    } & JoinReservationMeetCopy);

export interface JoinReservationMeetRequest {
  userId: string | number | null | undefined;
  reservationId: string;
}

export interface ReservationMeetJoiner {
  join(request: JoinReservationMeetRequest): Promise<JoinReservationMeetResult>;
  isPending(): boolean;
  subscribe(listener: () => void): () => void;
}

/* ================================
 * URL validation
 * ================================ */

/**
 * Returns the normalized href when `raw` is an `https:` URL on an
 * allow-listed video host (no credentials, default port), otherwise `null`.
 * Parsing with `new URL()` rejects prefix/suffix/userinfo host spoofing that
 * a plain `startsWith` check would let through.
 */
export function parseSafeMeetUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password || parsed.port) return null;
  if (!ALLOWED_MEET_HOSTS.includes(parsed.hostname)) return null;

  return parsed.href;
}

/* ================================
 * Workflow
 * ================================ */

function fail(
  reason: JoinReservationMeetFailureReason
): JoinReservationMeetResult {
  return { status: 'failed', reason, ...JOIN_MEET_FAILURE_COPY[reason] };
}

function classifyFetchError(error: unknown): JoinReservationMeetFailureReason {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'not_found';
    if (error.status === 403) return 'forbidden';
  }
  return 'request_failed';
}

function hasUserId(
  userId: JoinReservationMeetRequest['userId']
): userId is string | number {
  return Boolean(userId) && String(userId).trim() !== '';
}

export function createReservationMeetJoiner(
  overrides: Partial<JoinReservationMeetPorts> = {}
): ReservationMeetJoiner {
  const ports: JoinReservationMeetPorts = {
    meetLinkFetcher: overrides.meetLinkFetcher ?? apiMeetLinkFetcher,
    tabOpener: overrides.tabOpener ?? browserExternalTabOpener,
    // Resolved lazily at failure time (not at construction) so rendering a
    // consumer never touches the analytics module until a join fails.
    upgradeClaritySession:
      overrides.upgradeClaritySession ??
      ((reason) => upgradeClaritySession(reason)),
  };

  let inFlight = false;
  const listeners = new Set<() => void>();

  const setInFlight = (next: boolean) => {
    inFlight = next;
    listeners.forEach((listener) => listener());
  };

  async function join({
    userId,
    reservationId,
  }: JoinReservationMeetRequest): Promise<JoinReservationMeetResult> {
    if (!hasUserId(userId)) return fail('unauthenticated');

    // Single-flight lock is checked before any tab is opened: a rapid second
    // click must not flash an extra about:blank tab.
    if (inFlight) return { status: 'skipped', reason: 'in_flight' };
    setInFlight(true);

    // Opened synchronously (before the first await) so the browser still
    // treats it as part of the user's click gesture.
    const tab = ports.tabOpener.openPlaceholderTab();

    const abort = (
      reason: JoinReservationMeetFailureReason
    ): JoinReservationMeetResult => {
      tab?.close();
      ports.upgradeClaritySession(MEET_LINK_FETCH_FAILED_CLARITY_REASON);
      return fail(reason);
    };

    try {
      let rawUrl: string | null | undefined;
      try {
        rawUrl = await ports.meetLinkFetcher.fetchMeetUrl({
          userId,
          reservationId,
        });
      } catch (error) {
        return abort(classifyFetchError(error));
      }

      if (!rawUrl) return abort('missing_link');

      const safeUrl = parseSafeMeetUrl(rawUrl);
      if (!safeUrl) return abort('unsafe_link');

      try {
        if (tab) {
          tab.navigate(safeUrl);
          return { status: 'joined', target: 'new_tab' };
        }
        ports.tabOpener.navigateCurrentWindow(safeUrl);
        return { status: 'joined', target: 'current_window' };
      } catch {
        return abort('request_failed');
      }
    } finally {
      setInFlight(false);
    }
  }

  return {
    join,
    isPending: () => inFlight,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/* ================================
 * Production adapters
 * ================================ */

export const apiMeetLinkFetcher: MeetLinkFetcherPort = {
  async fetchMeetUrl({ userId, reservationId }) {
    const data = await fetchReservationMeetLink({ userId, reservationId });
    return data?.meet_url;
  },
};

export const browserExternalTabOpener: ExternalTabOpenerPort = {
  openPlaceholderTab() {
    const tab = window.open('about:blank', '_blank');
    if (!tab) return null;
    return {
      navigate(url) {
        tab.location.href = url;
      },
      close() {
        tab.close();
      },
    };
  },
  navigateCurrentWindow(url) {
    window.location.href = url;
  },
};

/* ================================
 * In-memory test adapters
 * ================================ */

export interface InMemoryExternalTab {
  url: string;
  closed: boolean;
}

export interface InMemoryExternalTabOpener extends ExternalTabOpenerPort {
  readonly tabs: InMemoryExternalTab[];
  readonly currentWindowNavigations: string[];
  readonly openAttempts: number;
}

export function createInMemoryExternalTabOpener(
  options: { blocked?: boolean } = {}
): InMemoryExternalTabOpener {
  const tabs: InMemoryExternalTab[] = [];
  const currentWindowNavigations: string[] = [];
  let openAttempts = 0;

  return {
    tabs,
    currentWindowNavigations,
    get openAttempts() {
      return openAttempts;
    },
    openPlaceholderTab() {
      openAttempts += 1;
      if (options.blocked) return null;
      const tab: InMemoryExternalTab = { url: 'about:blank', closed: false };
      tabs.push(tab);
      return {
        navigate(url) {
          tab.url = url;
        },
        close() {
          tab.closed = true;
        },
      };
    },
    navigateCurrentWindow(url) {
      currentWindowNavigations.push(url);
    },
  };
}

export interface InMemoryMeetLinkFetcher extends MeetLinkFetcherPort {
  readonly calls: MeetLinkRequest[];
}

export function createInMemoryMeetLinkFetcher(
  resolveMeetUrl: (
    request: MeetLinkRequest
  ) => Promise<string | null | undefined>
): InMemoryMeetLinkFetcher {
  const calls: MeetLinkRequest[] = [];
  return {
    calls,
    fetchMeetUrl(request) {
      calls.push(request);
      return resolveMeetUrl(request);
    },
  };
}
