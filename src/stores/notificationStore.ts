import { captureFlowFailure } from '@/lib/monitoring';
import { safeGetStorage, safeSetStorage } from '@/lib/storage';
import {
  httpNotificationSource,
  type NotificationSource,
} from '@/services/notifications/notificationSource';
import type { NotificationItem } from '@/services/notifications/types';

export type { NotificationItem } from '@/services/notifications/types';

export type NotificationStatus = 'loading' | 'error' | 'empty' | 'success';

const getStoreKey = (userId?: string): string => userId || 'generic';

const SEEN_COUNT_STORAGE_PREFIX = 'notif_seen_unread_count_';

const getStorageKey = (userId?: string): string =>
  `${SEEN_COUNT_STORAGE_PREFIX}${getStoreKey(userId)}`;

function reportStoreFailure(flow: string, step: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[NotificationStoreManager] ${step} failed:`, message);
  void captureFlowFailure({ flow, step, message });
}

export interface SharedNotificationState {
  status: NotificationStatus;
  notifications: NotificationItem[];
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
  const storageKey = getStorageKey(userId);

  return {
    status: hasInitial ? initialStatus : 'loading',
    notifications: initialNotifications ?? [],
    seenUnreadCount: getStoredSeenCount(storageKey),
    nextCursor: null,
    unreadCountState: initialNotifications
      ? initialNotifications.filter((n) => n.unread).length
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

class NotificationStoreManager {
  private states = new Map<string, SharedNotificationState>();
  private listeners = new Map<string, Set<() => void>>();
  private fetchPromises = new Map<
    string,
    Promise<LoadInitialDataOutcome> | null
  >();
  private unreadCountFetchPromises = new Map<
    string,
    Promise<LoadUnreadCountOutcome> | null
  >();
  private unreadCountVersions = new Map<string, number>();
  private sources = new Map<string, NotificationSource>();
  private bootstrappedSources = new Map<string, NotificationSource>();
  private openInstances = new Map<string, Set<symbol>>();
  private retryEpochs = new Map<string, number>();

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

  private resolveSource(userId: string | undefined): NotificationSource {
    return this.getSource(userId) ?? httpNotificationSource;
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
    const source = this.sources.get(key) ?? httpNotificationSource;
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

  /**
   * Persist the seen-unread-count to localStorage and the shared state.
   */
  setSeenCount(userId: string | undefined, val: number): void {
    safeSetStorage(getStorageKey(userId), String(val));
    this.updateState(userId, { seenUnreadCount: val });
  }

  /**
   * Reconcile seenUnreadCount with whatever is currently in localStorage.
   */
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
          console.error('[NotificationStoreManager] listener error:', e);
        }
      });
    }
  }

  clear(): void {
    this.states.clear();
    this.listeners.clear();
    this.fetchPromises.clear();
    this.unreadCountFetchPromises.clear();
    this.unreadCountVersions.clear();
    this.sources.clear();
    this.bootstrappedSources.clear();
    this.openInstances.clear();
    this.retryEpochs.clear();
  }

  setSource(userId: string | undefined, source: NotificationSource): void {
    const key = getStoreKey(userId);
    this.sources.set(key, source);
  }

  getSource(userId: string | undefined): NotificationSource | undefined {
    const key = getStoreKey(userId);
    return this.sources.get(key);
  }

  /**
   * Single idempotent lifecycle entry point invoked by `useNotificationCenter`.
   * When multiple instances (e.g. desktop + mobile `NotificationBell`) mount
   * for the same `userId`, only the first instance reconciles storage and
   * triggers the initial unread-count bootstrap for that source.
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

  /**
   * Mark a subscriber panel as opened, persist current unread count as seen,
   * and trigger lazy initial/background list loading via the installed source.
   */
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

  /**
   * Intent-level operation: mark a single notification as read via the
   * installed `NotificationSource`, with reentry guard and rollback on failure.
   */
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

    this.startMarkRead(userId, id);

    const effectiveUserId = userId || 'generic';

    try {
      await source.markOneRead(effectiveUserId, id);
      this.completeMarkRead(userId, id);
      return { status: 'success' };
    } catch (error) {
      this.failMarkRead(userId, id);
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

    const unreadIds = state.notifications
      .filter((item) => item.unread)
      .map((item) => item.id);

    const unreadIdSet = new Set(unreadIds);
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

  /**
   * Intent-level operation: mark all notifications as read via the installed
   * `NotificationSource`, with reentry guard and version-aware rollback.
   */
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

    const { rollback } = this.startMarkAllRead(userId);
    const effectiveUserId = userId || 'generic';

    try {
      await source.markAllRead(effectiveUserId);
      this.completeMarkAllRead(userId);
      return { status: 'success' };
    } catch (error) {
      rollback();
      this.completeMarkAllRead(userId);
      reportStoreFailure('notification_mark_all_read', 'mark_all_read', error);
      return { status: 'failed', error };
    }
  }

  private startLoadMore(userId: string | undefined): void {
    this.updateState(userId, {
      isLoadingMore: true,
      hasLoadMoreError: false,
    });
  }

  private failLoadMore(userId: string | undefined): void {
    this.updateState(userId, {
      hasLoadMoreError: true,
    });
  }

  private completeLoadMore(userId: string | undefined): void {
    this.updateState(userId, {
      isLoadingMore: false,
    });
  }

  private appendNotifications(
    userId: string | undefined,
    items: NotificationItem[],
    nextCursor: string | null
  ): void {
    const state = this.getOrCreateState(userId);
    this.updateState(userId, {
      notifications: [...state.notifications, ...items],
      nextCursor,
    });
  }

  /**
   * Intent-level operation: load the next cursor page of notifications.
   */
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

    this.startLoadMore(userId);
    const effectiveUserId = userId || 'generic';

    try {
      const res = await source.listNotifications(
        effectiveUserId,
        state.nextCursor,
        20
      );
      this.appendNotifications(
        userId,
        (res && res.notifications) || [],
        (res && res.next_cursor) || null
      );
      return { status: 'success' };
    } catch (error) {
      this.failLoadMore(userId);
      return { status: 'failed', error };
    } finally {
      this.completeLoadMore(userId);
    }
  }

  /**
   * Unified retry operation behind `NotificationSource`.
   * Delegates to `source.retry` when provided; otherwise recovers directly by
   * re-fetching initial unread count + first page from `source` under the same
   * per-key epoch staleness guard.
   */
  async retry(userId: string | undefined): Promise<RetryOutcome> {
    const source = this.resolveSource(userId);
    if (!source.retry && this.shouldSkipSourceReads(userId, source)) {
      return { status: 'skipped' };
    }

    const key = getStoreKey(userId);
    const epoch = (this.retryEpochs.get(key) ?? 0) + 1;
    this.retryEpochs.set(key, epoch);
    const effectiveUserId = userId || 'generic';

    this.updateState(userId, { status: 'loading' });

    try {
      if (source.retry) {
        const notifications = await source.retry(effectiveUserId);
        if (this.retryEpochs.get(key) !== epoch) return { status: 'stale' };
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
      if (this.retryEpochs.get(key) !== epoch) return { status: 'stale' };

      this.setInitialData(
        userId,
        unreadRes.unread_count,
        (notificationsRes && notificationsRes.notifications) || [],
        (notificationsRes && notificationsRes.next_cursor) || null
      );
      return { status: 'success' };
    } catch (error) {
      if (this.retryEpochs.get(key) !== epoch) return { status: 'stale' };
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

  /**
   * Intent-level operation: bootstrap or refresh unread badge count via the
   * installed `NotificationSource`, deduplicating concurrent requests and
   * discarding stale responses if `unreadCountVersion` moved on.
   */
  async loadUnreadCount(
    userId: string | undefined
  ): Promise<LoadUnreadCountOutcome> {
    const source = this.resolveSource(userId);
    if (this.shouldSkipSourceReads(userId, source)) {
      return { status: 'skipped' };
    }

    const key = getStoreKey(userId);
    const state = this.getOrCreateState(userId);

    if (state.isFetchingUnreadCount) {
      const existingPromise = this.unreadCountFetchPromises.get(key);
      if (existingPromise) {
        return existingPromise;
      }
    }

    const versionAtStart = this.unreadCountVersions.get(key) ?? 0;
    const effectiveUserId = userId || 'generic';

    const fetchPromise = (async (): Promise<LoadUnreadCountOutcome> => {
      try {
        const res = await source.getUnreadCount(effectiveUserId);
        this.setUnreadCount(userId, res.unread_count, versionAtStart);
        return { status: 'success' };
      } catch (error) {
        reportStoreFailure(
          'notification_load_unread_count',
          'fetch_unread_count',
          error
        );
        return { status: 'failed', error };
      } finally {
        this.unreadCountFetchPromises.delete(key);
        this.updateState(userId, {
          isFetchingUnreadCount: false,
        });
      }
    })();

    this.unreadCountFetchPromises.set(key, fetchPromise);
    this.updateState(userId, {
      isFetchingUnreadCount: true,
    });

    return fetchPromise;
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

    this.updateState(userId, {
      unreadCountState: unreadCount,
      notifications: items,
      nextCursor,
      status: items.length === 0 ? 'empty' : 'success',
      hasLoadMoreError: false,
    });
  }

  /**
   * Intent-level operation: load initial or refreshed notification list +
   * unread count via the installed `NotificationSource` with deduplication.
   */
  async loadInitialData(
    userId: string | undefined,
    showLoading?: boolean
  ): Promise<LoadInitialDataOutcome> {
    const source = this.resolveSource(userId);
    if (this.shouldSkipSourceReads(userId, source)) {
      return { status: 'skipped' };
    }

    const key = getStoreKey(userId);
    const state = this.getOrCreateState(userId);

    if (state.isFetching) {
      const existingPromise = this.fetchPromises.get(key);
      if (existingPromise) {
        return existingPromise;
      }
    }

    const isFirstLoad =
      state.status === 'loading' ||
      (state.status === 'error' && state.notifications.length === 0);
    const effectiveShowLoading = showLoading ?? isFirstLoad;
    const effectiveUserId = userId || 'generic';

    const fetchPromise = (async (): Promise<LoadInitialDataOutcome> => {
      try {
        const [unreadRes, notificationsRes] = await Promise.all([
          source.getUnreadCount(effectiveUserId),
          source.listNotifications(effectiveUserId, undefined, 20),
        ]);
        this.setInitialData(
          userId,
          unreadRes.unread_count,
          (notificationsRes && notificationsRes.notifications) || [],
          (notificationsRes && notificationsRes.next_cursor) || null
        );
        return { status: 'success' };
      } catch (error) {
        const currentState = this.getOrCreateState(userId);
        const hasExisting = currentState.notifications.length > 0;
        console.error(
          '[NotificationStoreManager] loadInitialData failed:',
          error
        );
        this.updateState(userId, {
          status: hasExisting ? 'success' : 'error',
        });
        return {
          status: 'failed',
          error,
          hadCachedNotifications: !effectiveShowLoading || hasExisting,
        };
      } finally {
        this.fetchPromises.delete(key);
        this.updateState(userId, {
          isFetching: false,
        });
      }
    })();

    this.fetchPromises.set(key, fetchPromise);
    this.updateState(userId, {
      isFetching: true,
      ...(effectiveShowLoading ? { status: 'loading' } : {}),
    });

    return fetchPromise;
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

      this.updateState(userId, {
        notifications: initialNotifications,
        status: initialStatus,
        unreadCountState: initialNotifications.filter((n) => n.unread).length,
      });
    }
  }
}

export const notificationStoreManager = new NotificationStoreManager();

export function resetNotificationStore(): void {
  notificationStoreManager.clear();
}
