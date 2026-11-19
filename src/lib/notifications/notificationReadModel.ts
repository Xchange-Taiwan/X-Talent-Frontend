import dayjs from 'dayjs';

import { apiClient } from '@/lib/apiClient';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  isNotificationMentorContext,
  type NotificationSemanticCategory,
  type ReservationRouteRole,
  resolveNotificationCategory,
  resolveNotificationTargetHref,
} from '@/lib/reservation/reservationRoutes';
import { ONBOARDING_HREF } from '@/lib/routes';
import { singleFlight } from '@/lib/singleFlight';
import { safeGetStorage, safeSetStorage } from '@/lib/storage';
import type { components } from '@/types/api';

export type NotificationType =
  | 'reservation_requested'
  | 'reservation_success'
  | 'reservation_failed'
  | 'reservation_canceled'
  | 'reservation_upcoming'
  | 'reservation_feedback_requested'
  | 'reservation_attendance_requested'
  | 'feedback_reminder'
  | 'reservation_feedback_reminder'
  | 'meeting_feedback_reminder'
  | 'feedback_received'
  | 'reservation_feedback_received'
  | 'meeting_feedback_received';

export type NotificationItem = {
  id: string;
  type: NotificationType;
  category?: NotificationSemanticCategory;
  targetHref?: string;
  title?: string;
  body?: string;
  menteeName?: string;
  mentorName?: string;
  reservationId?: string;
  createdAt: string;
  unread?: boolean;
  role?: 'mentor' | 'mentee';
  actorRole?: 'mentor' | 'mentee' | 'system';
  dtstart?: number;
  dtend?: number;
};

export type ProjectedNotificationItem = NotificationItem & {
  title: string;
  body: string;
  targetHref: string;
};

export type NotificationContent = {
  title: string;
  body: string;
};

export type NotificationStatus = 'loading' | 'error' | 'empty' | 'success';

export interface NotificationSource {
  /**
   * Whether this source's calls are only meaningful for an authenticated
   * user. Callers suppress reads and writes while they have no user id.
   */
  requiresAuth?: boolean;
  /**
   * Whether this source is seeded up-front instead of fetched. A preloaded
   * source already holds the whole list, so callers must not drive
   * refresh/pagination loads into it, and must not advance a "seen" badge
   * count from background refreshes on its behalf.
   */
  isPreloaded?: boolean;
  getUnreadCount(userId: string): Promise<{ unread_count: number }>;
  listNotifications(
    userId: string,
    cursor?: string | null,
    limit?: number
  ): Promise<{
    notifications: NotificationItem[];
    next_cursor: string | null;
  }>;
  markOneRead(userId: string, notificationId: string): Promise<unknown>;
  markAllRead(userId: string): Promise<unknown>;
  /**
   * Optional custom handler for manual retry in test/story sources; sources
   * that omit it recover via `getUnreadCount` + `listNotifications`.
   */
  retry?(userId: string): Promise<NotificationItem[]>;
}

export interface InMemoryNotificationSourceOptions {
  /**
   * Mirrors `httpNotificationSource` (`true`) by default so unauthenticated
   * callers skip fetches; pass `false` for standalone Storybook stories or
   * auth-free unit tests.
   */
  requiresAuth?: boolean;
  /**
   * Marks the source as preloaded so background count/pagination fetches are
   * suppressed when desired (e.g. static Storybook fixtures).
   */
  isPreloaded?: boolean;
  /**
   * Optional explicit initial unread count override (defaults to counting
   * `unread` items in the current in-memory list).
   */
  unreadCountOverride?: number;
}

// Below this, created_at is a seconds-precision Unix timestamp; at/above it,
// it's already in milliseconds (a seconds-precision timestamp only reaches
// this many digits in the year 2286).
const SECONDS_TIMESTAMP_MAX = 9999999999;

const SEEN_COUNT_STORAGE_PREFIX = 'notif_seen_unread_count_';

const getStoreKey = (userId?: string): string => userId || 'generic';

const getStorageKey = (userId?: string): string =>
  `${SEEN_COUNT_STORAGE_PREFIX}${getStoreKey(userId)}`;

function reportStoreFailure(flow: string, step: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[NotificationReadModel] ${step} failed:`, message);
  void captureFlowFailure({ flow, step, message });
}

type NotificationConfigEntry = {
  getContent: (item: NotificationItem) => NotificationContent;
};

function getMentorContext(item: NotificationItem): boolean {
  return isNotificationMentorContext({
    role: item.role,
    menteeName: item.menteeName,
  });
}

const FEEDBACK_REQUESTED_CONFIG: NotificationConfigEntry = {
  getContent: (item) => ({
    title: '留下您的會談回饋',
    body: `您與 ${item.mentorName || item.menteeName || 'Mentor'} 的會談已結束，前往留下回饋。`,
  }),
};

const ATTENDANCE_REQUESTED_CONFIG: NotificationConfigEntry = {
  getContent: (item) => ({
    title: '留下您的會談紀錄',
    body: `您與 ${item.menteeName || item.mentorName || 'Mentee'} 的會談已結束，前往留下紀錄。`,
  }),
};

const FEEDBACK_REMINDER_CONFIG: NotificationConfigEntry = {
  getContent: (item) => {
    const isMentor = getMentorContext(item);
    if (isMentor) {
      return {
        title: '留下您的會談紀錄',
        body: `您與 ${item.menteeName || 'Mentee'} 的會談已結束，前往留下紀錄。`,
      };
    }
    return {
      title: '留下您的會談回饋',
      body: `您與 ${item.mentorName || 'Mentor'} 的會談已結束，前往留下回饋。`,
    };
  },
};

const FEEDBACK_RECEIVED_CONFIG: NotificationConfigEntry = {
  getContent: (item) => ({
    title: '您收到新的回饋',
    body: `${item.menteeName?.trim() || 'Mentee'} 為您留下了一則會談回饋，前往查看。`,
  }),
};

const NOTIFICATION_CONFIG: Record<NotificationType, NotificationConfigEntry> = {
  reservation_requested: {
    getContent: (item) => ({
      title: '您有新的預約',
      body: `${item.menteeName || 'Mentee'} 與您提出預約需求，請前往接受預約`,
    }),
  },
  reservation_success: {
    getContent: (item) => ({
      title: `${item.mentorName || 'Mentor'} 已接受您的預約`,
      body: '前往查看您的預約詳情',
    }),
  },
  reservation_failed: {
    getContent: (item) => ({
      title: `您與 ${item.mentorName || 'Mentor'} 的預約已被拒絕`,
      body: '您的預約已被拒絕，歡迎重新預約',
    }),
  },
  reservation_canceled: {
    getContent: (item) => {
      const isMentor = getMentorContext(item);
      const name = item.mentorName || item.menteeName || '導師';
      if (item.actorRole === 'system') {
        return {
          title: `您與 ${name} 的預約已自動取消`,
          body: isMentor
            ? '因您未於預約開始前 24 小時前確認，系統已自動取消此預約'
            : '因導師未於預約開始前 24 小時前確認，系統已自動取消此預約，歡迎重新預約',
        };
      }
      return {
        title: `您與 ${name} 的預約已被取消`,
        body: isMentor
          ? '學員已取消此次預約，點擊查看預約紀錄'
          : '您的預約已被取消，歡迎重新預約',
      };
    },
  },
  reservation_upcoming: {
    getContent: (item) => {
      const name = item.mentorName || item.menteeName || '導師';
      if (typeof item.dtstart === 'number' && Number.isFinite(item.dtstart)) {
        const formattedTime = dayjs
          .unix(item.dtstart)
          .format('YYYY/MM/DD HH:mm');
        return {
          title: `您與 ${name} 的預約即將到來`,
          body: `您與 ${name} 的會議即將在 ${formattedTime} 開始，請準時上線`,
        };
      }
      return {
        title: `您與 ${name} 的預約即將到來`,
        body: `您 24 小時後有與 ${name} 的會議，請準時上線`,
      };
    },
  },
  reservation_feedback_requested: FEEDBACK_REQUESTED_CONFIG,
  reservation_attendance_requested: ATTENDANCE_REQUESTED_CONFIG,
  feedback_reminder: FEEDBACK_REMINDER_CONFIG,
  reservation_feedback_reminder: FEEDBACK_REMINDER_CONFIG,
  meeting_feedback_reminder: FEEDBACK_REMINDER_CONFIG,
  feedback_received: FEEDBACK_RECEIVED_CONFIG,
  reservation_feedback_received: FEEDBACK_RECEIVED_CONFIG,
  meeting_feedback_received: FEEDBACK_RECEIVED_CONFIG,
};

const DEFAULT_CONTENT: NotificationContent = {
  title: '通知',
  body: '您有一則新通知',
};

/**
 * Resolves localized title and body copy for a notification item.
 */
export function getNotificationContent(
  item: NotificationItem
): NotificationContent {
  const entry = NOTIFICATION_CONFIG[item.type];
  return entry ? entry.getContent(item) : DEFAULT_CONTENT;
}

/**
 * Resolves the destination href for a notification item.
 */
export function getNotificationHref(item: NotificationItem): string {
  if (item.targetHref) {
    return item.targetHref;
  }
  return resolveNotificationTargetHref({
    type: item.type,
    category: item.category,
    role: item.role,
    menteeName: item.menteeName,
    reservationId: item.reservationId,
  });
}

/**
 * Projects `title`, `body`, and `targetHref` once onto a notification item so
 * UI components never recompute copy or routing rules per render.
 */
export function projectNotificationItem(
  item: NotificationItem
): ProjectedNotificationItem {
  if (
    item.title !== undefined &&
    item.body !== undefined &&
    item.targetHref !== undefined
  ) {
    return item as ProjectedNotificationItem;
  }
  const content = getNotificationContent(item);
  const targetHref = getNotificationHref(item);
  return {
    ...item,
    title: item.title ?? content.title,
    body: item.body ?? content.body,
    targetHref,
  };
}

function normalizeNotificationRole(
  rawRole: unknown
): ReservationRouteRole | undefined {
  if (typeof rawRole !== 'string') return undefined;
  const lowered = rawRole.trim().toLowerCase();
  if (lowered === 'mentor' || lowered === 'mentee') {
    return lowered;
  }
  return undefined;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed !== '' ? trimmed : undefined;
}

function resolveDefaultNotificationRole(
  category: NotificationSemanticCategory,
  explicitMenteeName: string | undefined,
  explicitMentorName: string | undefined
): ReservationRouteRole | undefined {
  if (category === 'feedback_received' || category === 'attendance_requested') {
    return 'mentor';
  }
  if (category === 'feedback_requested') {
    return 'mentee';
  }
  if (category === 'feedback_reminder') {
    return explicitMenteeName && !explicitMentorName ? 'mentor' : 'mentee';
  }
  return undefined;
}

/**
 * Converts a backend `NotificationVO` DTO directly into a projected frontend
 * `ProjectedNotificationItem` with precomputed `title`, `body`, and `targetHref`.
 */
export function mapNotificationVOToItem(
  apiItem: components['schemas']['NotificationVO']
): ProjectedNotificationItem {
  const isUnread = !apiItem.read_at;
  const category = resolveNotificationCategory(apiItem.type);
  const metadata = (apiItem.metadata || {}) as {
    role?: 'mentor' | 'mentee' | 'MENTOR' | 'MENTEE';
    actor_role?: 'mentor' | 'mentee' | 'system';
    counterparty_name?: string;
    mentee_name?: string;
    menteeName?: string;
    mentor_name?: string;
    mentorName?: string;
    reservation_id?: number | string | null;
    reservationId?: number | string | null;
    reserve_id?: number | string | null;
    dtstart?: number;
    dtend?: number;
  };
  const { role, actor_role, counterparty_name, dtstart, dtend } = metadata;

  const explicitMenteeName =
    normalizeOptionalString(metadata.mentee_name) ??
    normalizeOptionalString(metadata.menteeName);
  const explicitMentorName =
    normalizeOptionalString(metadata.mentor_name) ??
    normalizeOptionalString(metadata.mentorName);

  const resolvedRole =
    normalizeNotificationRole(role) ??
    resolveDefaultNotificationRole(
      category,
      explicitMenteeName,
      explicitMentorName
    );

  const menteeName =
    resolvedRole === 'mentor'
      ? (normalizeOptionalString(counterparty_name) ?? explicitMenteeName)
      : explicitMenteeName;
  const mentorName =
    resolvedRole === 'mentee'
      ? (normalizeOptionalString(counterparty_name) ?? explicitMentorName)
      : explicitMentorName;
  const rawReservationId =
    metadata.reservation_id ?? metadata.reservationId ?? metadata.reserve_id;
  const normalizedReservationId =
    typeof rawReservationId === 'number' && Number.isFinite(rawReservationId)
      ? String(rawReservationId)
      : typeof rawReservationId === 'string' && rawReservationId.trim() !== ''
        ? rawReservationId.trim()
        : undefined;
  const normalizedDtstart =
    typeof dtstart === 'number' && Number.isFinite(dtstart)
      ? dtstart
      : undefined;
  const normalizedDtend =
    typeof dtend === 'number' && Number.isFinite(dtend) ? dtend : undefined;

  const rawTime = Number(apiItem.created_at) || Date.now();
  const ms = rawTime < SECONDS_TIMESTAMP_MAX ? rawTime * 1000 : rawTime;
  const createdAt = new Date(ms).toISOString();

  const targetHref = resolveNotificationTargetHref({
    type: apiItem.type,
    category,
    role: resolvedRole,
    menteeName,
    reservationId: normalizedReservationId,
  });

  return projectNotificationItem({
    id: String(apiItem.id),
    type: apiItem.type as NotificationType,
    category,
    targetHref,
    createdAt,
    unread: isUnread,
    role: resolvedRole,
    actorRole: actor_role,
    menteeName,
    mentorName,
    ...(normalizedReservationId !== undefined
      ? { reservationId: normalizedReservationId }
      : {}),
    ...(normalizedDtstart !== undefined ? { dtstart: normalizedDtstart } : {}),
    ...(normalizedDtend !== undefined ? { dtend: normalizedDtend } : {}),
  });
}

/**
 * Production HTTP adapter calling `apiClient.*Unwrapped` directly without
 * intermediate pass-through service wrappers.
 */
export const httpNotificationSource: NotificationSource = {
  requiresAuth: true,
  isPreloaded: false,
  async getUnreadCount(userId: string) {
    const res = await apiClient.getUnwrapped<
      components['schemas']['UnreadNotificationCountVO']
    >(`/v1/users/${userId}/notifications/unread-count`);
    return { unread_count: res?.unread_count ?? 0 };
  },
  async listNotifications(
    userId: string,
    cursor?: string | null,
    limit: number = 20
  ) {
    const res = await apiClient.getUnwrapped<
      components['schemas']['NotificationListVO']
    >(`/v1/users/${userId}/notifications`, {
      params: {
        cursor: cursor || undefined,
        batch: limit,
      },
    });
    return {
      notifications: (res?.notifications || []).map(mapNotificationVOToItem),
      next_cursor: res?.next_cursor ?? null,
    };
  },
  markOneRead(userId: string, notificationId: string) {
    return apiClient.putUnwrapped<components['schemas']['NotificationVO']>(
      `/v1/users/${userId}/notifications/${notificationId}`
    );
  },
  markAllRead(userId: string) {
    return apiClient.putUnwrapped<
      components['schemas']['MarkAllNotificationsReadVO']
    >(`/v1/users/${userId}/notifications/read-all`);
  },
};

function paginateNotificationItems(
  list: ProjectedNotificationItem[],
  cursor?: string | null,
  limit?: number
): { notifications: ProjectedNotificationItem[]; next_cursor: string | null } {
  const startIdx = cursor ? parseInt(cursor, 10) : 0;
  if (Number.isNaN(startIdx)) {
    return {
      notifications: list.map((item) => ({ ...item })),
      next_cursor: null,
    };
  }
  const pageSize = limit ?? 20;
  const paginated = list
    .slice(startIdx, startIdx + pageSize)
    .map((item) => ({ ...item }));
  const nextCursor =
    startIdx + pageSize < list.length ? String(startIdx + pageSize) : null;
  return {
    notifications: paginated,
    next_cursor: nextCursor,
  };
}

/**
 * Deterministic, zero-delay in-memory `NotificationSource` for unit tests and
 * Storybook stories.
 */
export function createInMemoryNotificationSource(
  initialNotifications: NotificationItem[] = [],
  options: InMemoryNotificationSourceOptions = {}
): NotificationSource {
  let list = initialNotifications.map((item) =>
    projectNotificationItem({ ...item })
  );
  const {
    requiresAuth = true,
    isPreloaded = false,
    unreadCountOverride,
  } = options;

  return {
    requiresAuth,
    isPreloaded,
    async getUnreadCount(_userId: string) {
      const count =
        unreadCountOverride !== undefined
          ? unreadCountOverride
          : list.filter((n) => n.unread).length;
      return { unread_count: count };
    },
    async listNotifications(
      _userId: string,
      cursor?: string | null,
      limit?: number
    ) {
      return paginateNotificationItems(list, cursor, limit);
    },
    async markOneRead(_userId: string, notificationId: string) {
      list = list.map((item) =>
        item.id === notificationId ? { ...item, unread: false } : item
      );
      return { success: true };
    },
    async markAllRead(_userId: string) {
      list = list.map((item) => ({ ...item, unread: false }));
      return { success: true };
    },
  };
}

export interface SharedNotificationState {
  status: NotificationStatus;
  notifications: ProjectedNotificationItem[];
  seenUnreadCount: number;
  nextCursor: string | null;
  unreadCountState: number;
  isLoadingMore: boolean;
  isPending: boolean;
  hasLoadMoreError: boolean;
  isFetching: boolean;
  isFetchingUnreadCount: boolean;
  markingReadIds: Set<string>;
  isMarkingAll: boolean;
}

export type LoadUnreadCountOutcome =
  | { status: 'skipped' }
  | { status: 'success' }
  | { status: 'failed'; error: unknown };

export type LoadInitialDataOutcome =
  | { status: 'skipped' }
  | { status: 'success' }
  | {
      status: 'failed';
      error: unknown;
      hadCachedNotifications: boolean;
    };

export type MarkReadOutcome =
  | { status: 'skipped' }
  | { status: 'success' }
  | { status: 'failed'; error: unknown };

export type MarkAllReadOutcome =
  | { status: 'skipped' }
  | { status: 'success' }
  | { status: 'failed'; error: unknown };

export type LoadMoreOutcome =
  | { status: 'skipped' }
  | { status: 'success' }
  | { status: 'failed'; error: unknown };

export type RetryOutcome =
  | { status: 'skipped' }
  | { status: 'stale' }
  | { status: 'success' }
  | { status: 'failed'; error: unknown };

export interface ConfigureStoreOptions {
  source?: NotificationSource;
  initialNotifications?: NotificationItem[];
  initialStatus?: NotificationStatus;
}

export interface ResolveNotificationUserIdOptions {
  userId?: string;
  enabled?: boolean;
  pathname?: string | null;
  isIncompleteOnboarding?: boolean;
  hasExplicitSource?: boolean;
}

export interface NotificationCenterView {
  badgeCount: number;
  showBadge: boolean;
  formattedCount: string;
  hasUnread: boolean;
  hasMore: boolean;
  olderUnreadCount: number;
}

export function resolveNotificationUserId({
  userId,
  enabled = true,
  pathname,
  isIncompleteOnboarding = false,
  hasExplicitSource = false,
}: ResolveNotificationUserIdOptions): string | undefined {
  const isOnboardingRoute = Boolean(
    pathname &&
    (pathname === ONBOARDING_HREF || pathname.startsWith(`${ONBOARDING_HREF}/`))
  );
  if (
    !enabled ||
    (!hasExplicitSource && (isIncompleteOnboarding || isOnboardingRoute))
  ) {
    return undefined;
  }
  return userId;
}

export function projectNotificationCenterView(
  state: SharedNotificationState,
  isMounted: boolean
): NotificationCenterView {
  const loadedUnreadCount = state.notifications.reduce(
    (acc, item) => (item.unread ? acc + 1 : acc),
    0
  );
  const badgeCount = state.unreadCountState;
  const hasMore = state.nextCursor !== null;
  const olderUnreadCount = hasMore
    ? Math.max(badgeCount - loadedUnreadCount, 0)
    : 0;
  const showBadge = isMounted && badgeCount > state.seenUnreadCount;
  const formattedCount = badgeCount > 99 ? '99+' : String(badgeCount);
  const hasUnread = badgeCount > 0;

  return {
    badgeCount,
    showBadge,
    formattedCount,
    hasUnread,
    hasMore,
    olderUnreadCount,
  };
}

const getStoredSeenCount = (key: string): number => {
  if (typeof window === 'undefined') return 0;
  const stored = safeGetStorage(key);
  const parsed = stored !== null ? Number(stored) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const createInitialState = (
  userId?: string,
  initialNotifications?: NotificationItem[],
  initialStatus: NotificationStatus = 'success'
): SharedNotificationState => {
  const hasInitial = initialNotifications !== undefined;
  const projectedInitial = initialNotifications?.map(projectNotificationItem);
  const storageKey = getStorageKey(userId);

  return {
    status: hasInitial ? initialStatus : 'loading',
    notifications: projectedInitial ?? [],
    seenUnreadCount: getStoredSeenCount(storageKey),
    nextCursor: null,
    unreadCountState: projectedInitial
      ? projectedInitial.filter((n) => n.unread).length
      : 0,
    isLoadingMore: false,
    isPending: false,
    hasLoadMoreError: false,
    isFetching: false,
    isFetchingUnreadCount: false,
    markingReadIds: new Set<string>(),
    isMarkingAll: false,
  };
};

function areNotificationsChanged(
  a: NotificationItem[] | undefined,
  b: NotificationItem[] | undefined
): boolean {
  if (a === b) return false;
  if (!a || !b) return true;
  if (a.length !== b.length) return true;
  return a.some(
    (item, index) =>
      item.id !== b[index].id ||
      item.unread !== b[index].unread ||
      item.type !== b[index].type
  );
}

export class NotificationReadModel {
  private states = new Map<string, SharedNotificationState>();
  private listeners = new Map<string, Set<() => void>>();
  private initialLoadFlights = new Map<
    string,
    Promise<LoadInitialDataOutcome>
  >();
  private unreadCountFlights = new Map<
    string,
    Promise<LoadUnreadCountOutcome>
  >();
  private unreadCountVersions = new Map<string, number>();
  private sources = new Map<string, NotificationSource>();
  private implicitSources = new Map<
    string,
    { seed: NotificationItem[]; source: NotificationSource }
  >();
  private bootstrappedSources = new Map<string, NotificationSource>();
  private openInstances = new Map<string, Set<symbol>>();
  private retryEpochs = new Map<string, number>();
  private generation = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageEvent);
    }
  }

  private handleStorageEvent = (e: StorageEvent) => {
    if (!e.key || !e.key.startsWith(SEEN_COUNT_STORAGE_PREFIX)) return;
    const key = e.key.slice(SEEN_COUNT_STORAGE_PREFIX.length);
    const val = e.newValue !== null ? Number(e.newValue) : 0;
    const parsedVal = Number.isNaN(val) ? 0 : val;
    this.updateState(key, { seenUnreadCount: parsedVal });
  };

  private resolveSourceByKey(key: string): NotificationSource {
    return (
      this.sources.get(key) ??
      this.implicitSources.get(key)?.source ??
      httpNotificationSource
    );
  }

  private resolveSource(userId: string | undefined): NotificationSource {
    return this.resolveSourceByKey(getStoreKey(userId));
  }

  private shouldSkipSourceReads(
    userId: string | undefined,
    source: NotificationSource
  ): boolean {
    return Boolean(source.isPreloaded || (!userId && source.requiresAuth));
  }

  private computeReconciledSeenCount(
    key: string,
    state: SharedNotificationState,
    unreadCountUpdated: boolean
  ): number {
    let seen = state.seenUnreadCount;
    const source = this.resolveSourceByKey(key);
    const isAnyPanelOpen = (this.openInstances.get(key)?.size ?? 0) > 0;

    if (
      state.status !== 'loading' &&
      !state.isPending &&
      seen > state.unreadCountState
    ) {
      seen = state.unreadCountState;
    }

    if (
      unreadCountUpdated &&
      !source.isPreloaded &&
      isAnyPanelOpen &&
      state.unreadCountState > seen
    ) {
      seen = state.unreadCountState;
    }

    return seen;
  }

  private reconcileSeenCountInPlace(userId: string | undefined): void {
    const key = getStoreKey(userId);
    const currentState = this.states.get(key);
    if (!currentState) return;

    const reconciled = this.computeReconciledSeenCount(
      key,
      currentState,
      false
    );
    if (reconciled !== currentState.seenUnreadCount) {
      safeSetStorage(getStorageKey(userId), String(reconciled));
      this.states.set(key, {
        ...currentState,
        seenUnreadCount: reconciled,
      });
      this.notify(key);
    }
  }

  setSeenCount(userId: string | undefined, val: number): void {
    safeSetStorage(getStorageKey(userId), String(val));
    this.updateState(userId, { seenUnreadCount: val });
  }

  syncSeenCountFromStorage(userId: string | undefined): void {
    const storedCount = getStoredSeenCount(getStorageKey(userId));
    const state = this.getOrCreateState(userId);
    if (state.seenUnreadCount !== storedCount) {
      this.updateState(userId, { seenUnreadCount: storedCount });
    }
  }

  getOrCreateState(
    userId?: string,
    initialNotifications?: NotificationItem[],
    initialStatus?: NotificationStatus
  ): SharedNotificationState {
    const key = getStoreKey(userId);

    if (typeof window === 'undefined') {
      return createInitialState(userId, initialNotifications, initialStatus);
    }

    if (!this.states.has(key)) {
      this.states.set(
        key,
        createInitialState(userId, initialNotifications, initialStatus)
      );
      this.unreadCountVersions.set(key, 0);
    }
    return this.states.get(key)!;
  }

  private updateState(
    userId: string | undefined,
    updates: Partial<SharedNotificationState>
  ): void {
    const key = getStoreKey(userId);
    const currentState = this.states.get(key);
    if (!currentState) return;

    const mergedState: SharedNotificationState = {
      ...currentState,
      ...updates,
    };

    const reconciledSeen = this.computeReconciledSeenCount(
      key,
      mergedState,
      updates.unreadCountState !== undefined
    );
    if (reconciledSeen !== mergedState.seenUnreadCount) {
      mergedState.seenUnreadCount = reconciledSeen;
      safeSetStorage(getStorageKey(userId), String(reconciledSeen));
    }

    this.states.set(key, mergedState);
    this.notify(key);
  }

  subscribe(userId: string | undefined, listener: () => void): () => void {
    const key = getStoreKey(userId);
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

    return () => {
      const set = this.listeners.get(key);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(key);
          this.bootstrappedSources.delete(key);
          this.openInstances.delete(key);
          this.retryEpochs.set(key, (this.retryEpochs.get(key) ?? 0) + 1);
        }
      }
    };
  }

  private notify(key: string): void {
    const set = this.listeners.get(key);
    if (set) {
      set.forEach((listener) => {
        try {
          listener();
        } catch (e) {
          console.error('[NotificationReadModel] listener error:', e);
        }
      });
    }
  }

  clear(): void {
    this.generation += 1;
    this.states.clear();
    this.listeners.clear();
    this.initialLoadFlights.clear();
    this.unreadCountFlights.clear();
    this.unreadCountVersions.clear();
    this.sources.clear();
    this.implicitSources.clear();
    this.bootstrappedSources.clear();
    this.openInstances.clear();
    this.retryEpochs.clear();
  }

  setSource(userId: string | undefined, source: NotificationSource): void {
    const key = getStoreKey(userId);
    this.sources.set(key, source);
    this.implicitSources.delete(key);
  }

  getSource(userId: string | undefined): NotificationSource | undefined {
    const key = getStoreKey(userId);
    return this.sources.get(key);
  }

  /**
   * Single idempotent lifecycle entry point invoked by `useNotificationCenter`.
   */
  configure(
    userId: string | undefined,
    options: ConfigureStoreOptions = {}
  ): void {
    const key = getStoreKey(userId);
    const {
      source: explicitSource,
      initialNotifications,
      initialStatus = 'success',
    } = options;

    this.getOrCreateState(userId, initialNotifications, initialStatus);

    if (explicitSource !== undefined) {
      this.sources.set(key, explicitSource);
      this.implicitSources.delete(key);
    } else if (!this.sources.has(key) && initialNotifications !== undefined) {
      const existingImplicit = this.implicitSources.get(key);
      if (!existingImplicit || existingImplicit.seed !== initialNotifications) {
        this.implicitSources.set(key, {
          seed: initialNotifications,
          source: createInMemoryNotificationSource(initialNotifications, {
            requiresAuth: false,
            isPreloaded: true,
          }),
        });
      }
    }

    const effectiveSource = this.resolveSource(userId);
    const wasBootstrapped = this.bootstrappedSources.has(key);

    if (!wasBootstrapped) {
      this.syncSeenCountFromStorage(userId);
    }

    if (initialNotifications !== undefined) {
      this.syncInitialNotifications(
        userId,
        initialNotifications,
        initialStatus
      );
    }

    this.reconcileSeenCountInPlace(userId);

    if (this.bootstrappedSources.get(key) === effectiveSource) {
      return;
    }

    this.bootstrappedSources.set(key, effectiveSource);
    void this.loadUnreadCount(userId);
  }

  async openPanel(
    userId: string | undefined,
    instanceId?: symbol
  ): Promise<LoadInitialDataOutcome> {
    const key = getStoreKey(userId);
    if (instanceId) {
      if (!this.openInstances.has(key)) {
        this.openInstances.set(key, new Set());
      }
      this.openInstances.get(key)!.add(instanceId);
    }

    const state = this.getOrCreateState(userId);
    this.setSeenCount(userId, state.unreadCountState);

    return this.loadInitialData(userId);
  }

  closePanel(userId: string | undefined, instanceId?: symbol): void {
    if (!instanceId) return;
    const key = getStoreKey(userId);
    const openSet = this.openInstances.get(key);
    if (openSet) {
      openSet.delete(instanceId);
      if (openSet.size === 0) {
        this.openInstances.delete(key);
      }
    }
  }

  private startMarkRead(userId: string | undefined, id: string): void {
    const state = this.getOrCreateState(userId);
    const markingReadIdsCopy = new Set(state.markingReadIds);
    markingReadIdsCopy.add(id);

    this.updateState(userId, {
      isPending: true,
      markingReadIds: markingReadIdsCopy,
      notifications: state.notifications.map((item) =>
        item.id === id ? { ...item, unread: false } : item
      ),
      unreadCountState: Math.max(0, state.unreadCountState - 1),
    });
  }

  private completeMarkRead(userId: string | undefined, id: string): void {
    const state = this.getOrCreateState(userId);
    const markingReadIdsCopy = new Set(state.markingReadIds);
    markingReadIdsCopy.delete(id);

    this.updateState(userId, {
      isPending: markingReadIdsCopy.size > 0 || state.isMarkingAll,
      markingReadIds: markingReadIdsCopy,
    });
  }

  private failMarkRead(userId: string | undefined, id: string): void {
    const state = this.getOrCreateState(userId);
    const markingReadIdsCopy = new Set(state.markingReadIds);
    markingReadIdsCopy.delete(id);

    let countDiff = 0;
    const notifications = state.notifications.map((item) => {
      if (item.id === id && !item.unread) {
        countDiff += 1;
        return { ...item, unread: true };
      }
      return item;
    });

    this.updateState(userId, {
      isPending: markingReadIdsCopy.size > 0 || state.isMarkingAll,
      markingReadIds: markingReadIdsCopy,
      ...(countDiff > 0
        ? {
            notifications,
            unreadCountState: state.unreadCountState + countDiff,
          }
        : {}),
    });
  }

  async markRead(
    userId: string | undefined,
    id: string
  ): Promise<MarkReadOutcome> {
    const source = this.resolveSource(userId);
    const canMutate = userId !== undefined || !source.requiresAuth;
    if (!canMutate) return { status: 'skipped' };

    const state = this.getOrCreateState(userId);
    if (state.markingReadIds.has(id)) return { status: 'skipped' };

    const targetItem = state.notifications.find((n) => n.id === id);
    if (!targetItem || !targetItem.unread) return { status: 'skipped' };

    const genAtStart = this.generation;
    this.startMarkRead(userId, id);
    const effectiveUserId = userId || 'generic';

    try {
      await source.markOneRead(effectiveUserId, id);
      if (this.generation === genAtStart) {
        this.completeMarkRead(userId, id);
      }
      return { status: 'success' };
    } catch (error) {
      if (this.generation === genAtStart) {
        this.failMarkRead(userId, id);
      }
      reportStoreFailure(
        'notification_mark_all_read',
        `mark_read_click:${id}`,
        error
      );
      return { status: 'failed', error };
    }
  }

  private startMarkAllRead(userId: string | undefined): {
    rollback: () => void;
  } {
    const key = getStoreKey(userId);
    const state = this.getOrCreateState(userId);
    const previousCount = state.unreadCountState;
    const previousIsMarkingAll = state.isMarkingAll;
    const prevVersion = this.unreadCountVersions.get(key) ?? 0;

    const unreadIdSet = new Set(
      state.notifications.filter((item) => item.unread).map((item) => item.id)
    );

    this.updateState(userId, {
      isPending: true,
      notifications: state.notifications.map((item) =>
        unreadIdSet.has(item.id) ? { ...item, unread: false } : item
      ),
      unreadCountState: 0,
      isMarkingAll: true,
    });

    const rollback = () => {
      const currentState = this.getOrCreateState(userId);
      const currentVersion = this.unreadCountVersions.get(key) ?? 0;

      const notifications = currentState.notifications.map((item) => {
        if (unreadIdSet.has(item.id) && !item.unread) {
          return { ...item, unread: true };
        }
        return item;
      });

      this.updateState(userId, {
        notifications,
        isMarkingAll: previousIsMarkingAll,
        unreadCountState:
          currentVersion === prevVersion
            ? previousCount
            : currentState.unreadCountState,
      });
    };

    return { rollback };
  }

  private completeMarkAllRead(userId: string | undefined): void {
    const state = this.getOrCreateState(userId);
    this.updateState(userId, {
      isPending: state.markingReadIds.size > 0,
      isMarkingAll: false,
    });
  }

  async markAllRead(userId: string | undefined): Promise<MarkAllReadOutcome> {
    const source = this.resolveSource(userId);
    const canMutate = userId !== undefined || !source.requiresAuth;
    if (!canMutate) return { status: 'skipped' };

    const state = this.getOrCreateState(userId);
    if (state.isMarkingAll) return { status: 'skipped' };

    const hasUnreadInList = state.notifications.some((item) => item.unread);
    if (!hasUnreadInList && state.unreadCountState === 0) {
      return { status: 'skipped' };
    }

    const genAtStart = this.generation;
    const { rollback } = this.startMarkAllRead(userId);
    const effectiveUserId = userId || 'generic';

    try {
      await source.markAllRead(effectiveUserId);
      if (this.generation === genAtStart) {
        this.completeMarkAllRead(userId);
      }
      return { status: 'success' };
    } catch (error) {
      if (this.generation === genAtStart) {
        rollback();
        this.completeMarkAllRead(userId);
      }
      reportStoreFailure('notification_mark_all_read', 'mark_all_read', error);
      return { status: 'failed', error };
    }
  }

  private appendNotifications(
    userId: string | undefined,
    items: NotificationItem[],
    nextCursor: string | null
  ): void {
    const state = this.getOrCreateState(userId);
    this.updateState(userId, {
      notifications: [
        ...state.notifications,
        ...items.map(projectNotificationItem),
      ],
      nextCursor,
    });
  }

  async loadMore(
    userId: string | undefined,
    isRetry = false
  ): Promise<LoadMoreOutcome> {
    const source = this.resolveSource(userId);
    if (this.shouldSkipSourceReads(userId, source)) {
      return { status: 'skipped' };
    }

    const state = this.getOrCreateState(userId);
    if (state.isLoadingMore || !state.nextCursor) return { status: 'skipped' };
    if (state.hasLoadMoreError && !isRetry) return { status: 'skipped' };
    if (state.isFetching) return { status: 'skipped' };

    const genAtStart = this.generation;
    this.updateState(userId, {
      isLoadingMore: true,
      hasLoadMoreError: false,
    });
    const effectiveUserId = userId || 'generic';

    try {
      const res = await source.listNotifications(
        effectiveUserId,
        state.nextCursor,
        20
      );
      if (this.generation === genAtStart) {
        this.appendNotifications(
          userId,
          res?.notifications ?? [],
          res?.next_cursor ?? null
        );
      }
      return { status: 'success' };
    } catch (error) {
      if (this.generation === genAtStart) {
        this.updateState(userId, { hasLoadMoreError: true });
      }
      return { status: 'failed', error };
    } finally {
      if (this.generation === genAtStart) {
        this.updateState(userId, { isLoadingMore: false });
      }
    }
  }

  async retry(userId: string | undefined): Promise<RetryOutcome> {
    const source = this.resolveSource(userId);
    if (!source.retry && this.shouldSkipSourceReads(userId, source)) {
      return { status: 'skipped' };
    }

    const key = getStoreKey(userId);
    const epoch = (this.retryEpochs.get(key) ?? 0) + 1;
    this.retryEpochs.set(key, epoch);
    const genAtStart = this.generation;
    const effectiveUserId = userId || 'generic';

    this.updateState(userId, { status: 'loading' });

    try {
      if (source.retry) {
        const notifications = await source.retry(effectiveUserId);
        if (
          this.generation !== genAtStart ||
          this.retryEpochs.get(key) !== epoch
        ) {
          return { status: 'stale' };
        }
        this.setInitialData(
          userId,
          notifications.filter((n) => n.unread).length,
          notifications,
          null
        );
        return { status: 'success' };
      }

      const [unreadRes, notificationsRes] = await Promise.all([
        source.getUnreadCount(effectiveUserId),
        source.listNotifications(effectiveUserId, undefined, 20),
      ]);
      if (
        this.generation !== genAtStart ||
        this.retryEpochs.get(key) !== epoch
      ) {
        return { status: 'stale' };
      }

      this.setInitialData(
        userId,
        unreadRes.unread_count,
        notificationsRes?.notifications ?? [],
        notificationsRes?.next_cursor ?? null
      );
      return { status: 'success' };
    } catch (error) {
      if (
        this.generation !== genAtStart ||
        this.retryEpochs.get(key) !== epoch
      ) {
        return { status: 'stale' };
      }
      this.updateState(userId, { status: 'error' });
      reportStoreFailure('notification_retry', 'source_retry', error);
      return { status: 'failed', error };
    }
  }

  setUnreadCount(
    userId: string | undefined,
    unreadCount: number,
    expectedVersion?: number
  ): void {
    const key = getStoreKey(userId);
    const currentVersion = this.unreadCountVersions.get(key) ?? 0;
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      return;
    }
    this.unreadCountVersions.set(key, currentVersion + 1);
    this.updateState(userId, {
      unreadCountState: unreadCount,
    });
  }

  loadUnreadCount(userId: string | undefined): Promise<LoadUnreadCountOutcome> {
    const source = this.resolveSource(userId);
    if (this.shouldSkipSourceReads(userId, source)) {
      return Promise.resolve({ status: 'skipped' });
    }

    const key = getStoreKey(userId);
    this.getOrCreateState(userId);

    return singleFlight(this.unreadCountFlights, key, async () => {
      const versionAtStart = this.unreadCountVersions.get(key) ?? 0;
      const genAtStart = this.generation;
      const effectiveUserId = userId || 'generic';

      this.updateState(userId, { isFetchingUnreadCount: true });

      try {
        const res = await source.getUnreadCount(effectiveUserId);
        if (this.generation === genAtStart) {
          this.setUnreadCount(userId, res.unread_count, versionAtStart);
        }
        return { status: 'success' };
      } catch (error) {
        reportStoreFailure(
          'notification_load_unread_count',
          'fetch_unread_count',
          error
        );
        return { status: 'failed', error };
      } finally {
        if (this.generation === genAtStart) {
          this.updateState(userId, { isFetchingUnreadCount: false });
        }
      }
    });
  }

  setInitialData(
    userId: string | undefined,
    unreadCount: number,
    items: NotificationItem[],
    nextCursor: string | null
  ): void {
    const key = getStoreKey(userId);
    const currentVersion = this.unreadCountVersions.get(key) ?? 0;
    this.unreadCountVersions.set(key, currentVersion + 1);
    const projectedItems = items.map(projectNotificationItem);

    this.updateState(userId, {
      unreadCountState: unreadCount,
      notifications: projectedItems,
      nextCursor,
      status: projectedItems.length === 0 ? 'empty' : 'success',
      hasLoadMoreError: false,
    });
  }

  loadInitialData(
    userId: string | undefined,
    showLoading?: boolean
  ): Promise<LoadInitialDataOutcome> {
    const source = this.resolveSource(userId);
    if (this.shouldSkipSourceReads(userId, source)) {
      return Promise.resolve({ status: 'skipped' });
    }

    const key = getStoreKey(userId);
    const initialState = this.getOrCreateState(userId);

    return singleFlight(this.initialLoadFlights, key, async () => {
      const isFirstLoad =
        initialState.status === 'loading' ||
        (initialState.status === 'error' &&
          initialState.notifications.length === 0);
      const effectiveShowLoading = showLoading ?? isFirstLoad;
      const genAtStart = this.generation;
      const effectiveUserId = userId || 'generic';

      this.updateState(userId, {
        isFetching: true,
        ...(effectiveShowLoading ? { status: 'loading' } : {}),
      });

      try {
        const [unreadRes, notificationsRes] = await Promise.all([
          source.getUnreadCount(effectiveUserId),
          source.listNotifications(effectiveUserId, undefined, 20),
        ]);
        if (this.generation !== genAtStart) {
          return { status: 'skipped' };
        }
        this.setInitialData(
          userId,
          unreadRes.unread_count,
          notificationsRes?.notifications ?? [],
          notificationsRes?.next_cursor ?? null
        );
        return { status: 'success' };
      } catch (error) {
        if (this.generation !== genAtStart) {
          return { status: 'skipped' };
        }
        const currentState = this.getOrCreateState(userId);
        const hasExisting = currentState.notifications.length > 0;
        console.error('[NotificationReadModel] loadInitialData failed:', error);
        this.updateState(userId, {
          status: hasExisting ? 'success' : 'error',
        });
        return {
          status: 'failed',
          error,
          hadCachedNotifications: !effectiveShowLoading || hasExisting,
        };
      } finally {
        if (this.generation === genAtStart) {
          this.updateState(userId, { isFetching: false });
        }
      }
    });
  }

  syncInitialNotifications(
    userId: string | undefined,
    initialNotifications: NotificationItem[],
    initialStatus: NotificationStatus
  ): void {
    const state = this.getOrCreateState(userId);
    if (
      areNotificationsChanged(initialNotifications, state.notifications) ||
      initialStatus !== state.status
    ) {
      const key = getStoreKey(userId);
      const currentVersion = this.unreadCountVersions.get(key) ?? 0;
      this.unreadCountVersions.set(key, currentVersion + 1);
      const projected = initialNotifications.map(projectNotificationItem);

      this.updateState(userId, {
        notifications: projected,
        status: initialStatus,
        unreadCountState: projected.filter((n) => n.unread).length,
      });
    }
  }
}

export const notificationReadModel = new NotificationReadModel();

export const notificationStoreManager = notificationReadModel;

export function resetNotificationReadModel(): void {
  notificationReadModel.clear();
}

export function resetNotificationStore(): void {
  notificationReadModel.clear();
}
