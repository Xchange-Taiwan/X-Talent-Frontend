import { beforeEach, describe, expect, it, vi } from 'vitest';

import { captureFlowFailure } from '@/lib/monitoring';
import {
  createInMemoryNotificationSource,
  type NotificationSource,
} from '@/services/notifications/notificationSource';
import type { NotificationItem } from '@/services/notifications/types';

import { notificationStoreManager } from './notificationStore';

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const SAMPLE_ITEMS: NotificationItem[] = [
  {
    id: 'n1',
    type: 'reservation_requested',
    createdAt: '2026-01-01T00:00:00.000Z',
    unread: true,
  },
  {
    id: 'n2',
    type: 'reservation_success',
    createdAt: '2026-01-01T00:01:00.000Z',
    unread: true,
  },
  {
    id: 'n3',
    type: 'reservation_failed',
    createdAt: '2026-01-01T00:02:00.000Z',
    unread: false,
  },
];

describe('notificationStoreManager lifecycle & NotificationSource port', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(captureFlowFailure).mockClear();
    notificationStoreManager.clear();
  });

  describe('source ownership & deterministic clear()', () => {
    it('returns undefined for a store key with no source set yet', () => {
      expect(notificationStoreManager.getSource('user-1')).toBeUndefined();
    });

    it('returns the source previously handed off via setSource', () => {
      const source = createInMemoryNotificationSource();
      notificationStoreManager.setSource('user-1', source);

      expect(notificationStoreManager.getSource('user-1')).toBe(source);
    });

    it('keeps sources isolated per store key', () => {
      const sourceA = createInMemoryNotificationSource();
      const sourceB = createInMemoryNotificationSource();
      notificationStoreManager.setSource('user-1', sourceA);
      notificationStoreManager.setSource('user-2', sourceB);

      expect(notificationStoreManager.getSource('user-1')).toBe(sourceA);
      expect(notificationStoreManager.getSource('user-2')).toBe(sourceB);
    });

    it('overwrites a store key source when setSource is called again', () => {
      const first = createInMemoryNotificationSource();
      const second = createInMemoryNotificationSource();
      notificationStoreManager.setSource('user-1', first);
      notificationStoreManager.setSource('user-1', second);

      expect(notificationStoreManager.getSource('user-1')).toBe(second);
    });

    it('resets state, sources, bootstrap markers, and open panels on clear()', async () => {
      const source = createInMemoryNotificationSource(SAMPLE_ITEMS);
      const countSpy = vi.spyOn(source, 'getUnreadCount');

      notificationStoreManager.configure('user-1', { source });
      await vi.waitFor(() => {
        expect(
          notificationStoreManager.getOrCreateState('user-1').unreadCountState
        ).toBe(2);
      });
      expect(countSpy).toHaveBeenCalledTimes(1);

      notificationStoreManager.clear();

      expect(notificationStoreManager.getSource('user-1')).toBeUndefined();
      expect(
        notificationStoreManager.getOrCreateState('user-1').unreadCountState
      ).toBe(0);

      // Re-configuring with the same source after clear() bootstraps cleanly again
      notificationStoreManager.configure('user-1', { source });
      await vi.waitFor(() => {
        expect(countSpy).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('idempotent configure() bootstrap across sibling instances', () => {
    it('bootstraps unread count only once when desktop and mobile instances configure the same userId and source', async () => {
      const source = createInMemoryNotificationSource(SAMPLE_ITEMS);
      const countSpy = vi.spyOn(source, 'getUnreadCount');
      const listSpy = vi.spyOn(source, 'listNotifications');

      const unsubDesktop = notificationStoreManager.subscribe(
        'user-1',
        () => {}
      );
      const unsubMobile = notificationStoreManager.subscribe(
        'user-1',
        () => {}
      );

      notificationStoreManager.configure('user-1', { source });
      notificationStoreManager.configure('user-1', { source });

      await vi.waitFor(() => {
        expect(
          notificationStoreManager.getOrCreateState('user-1').unreadCountState
        ).toBe(2);
      });

      expect(countSpy).toHaveBeenCalledTimes(1);
      expect(listSpy).not.toHaveBeenCalled();

      unsubDesktop();
      unsubMobile();
    });

    it('re-bootstraps after every subscriber for the store key unsubscribes', async () => {
      const source = createInMemoryNotificationSource(SAMPLE_ITEMS);
      const countSpy = vi.spyOn(source, 'getUnreadCount');

      const unsub = notificationStoreManager.subscribe('user-1', () => {});
      notificationStoreManager.configure('user-1', { source });
      await vi.waitFor(() => {
        expect(countSpy).toHaveBeenCalledTimes(1);
      });

      unsub();

      const unsubNext = notificationStoreManager.subscribe('user-1', () => {});
      notificationStoreManager.configure('user-1', { source });
      await vi.waitFor(() => {
        expect(countSpy).toHaveBeenCalledTimes(2);
      });

      unsubNext();
    });
  });

  describe('unified retry() behind NotificationSource', () => {
    it('recovers directly via getUnreadCount + listNotifications when source omits retry()', async () => {
      const items = Array.from({ length: 22 }, (_, i) => ({
        id: `id-${i + 1}`,
        type: 'reservation_requested' as const,
        createdAt: '2026-01-01T00:00:00.000Z',
        unread: i < 4,
      }));
      const source = createInMemoryNotificationSource(items);
      notificationStoreManager.setSource('user-retry', source);
      notificationStoreManager.getOrCreateState('user-retry');

      const outcome = await notificationStoreManager.retry('user-retry');

      expect(outcome).toEqual({ status: 'success' });
      const state = notificationStoreManager.getOrCreateState('user-retry');
      expect(state.status).toBe('success');
      expect(state.unreadCountState).toBe(4);
      expect(state.notifications).toHaveLength(20);
      expect(state.nextCursor).toBe('20');
    });

    it('delegates to source.retry when provided and discards stale resolutions', async () => {
      const firstDeferred = createDeferred<NotificationItem[]>();
      const secondDeferred = createDeferred<NotificationItem[]>();
      let call = 0;

      const source: NotificationSource = {
        requiresAuth: false,
        isPreloaded: false,
        getUnreadCount: async () => ({ unread_count: 0 }),
        listNotifications: async () => ({
          notifications: [],
          next_cursor: null,
        }),
        markOneRead: async () => {},
        markAllRead: async () => {},
        retry: () => {
          call += 1;
          return call === 1 ? firstDeferred.promise : secondDeferred.promise;
        },
      };

      notificationStoreManager.setSource('user-epoch', source);
      notificationStoreManager.getOrCreateState('user-epoch');

      const p1 = notificationStoreManager.retry('user-epoch');
      const p2 = notificationStoreManager.retry('user-epoch');

      secondDeferred.resolve([SAMPLE_ITEMS[0]]);
      expect(await p2).toEqual({ status: 'success' });

      firstDeferred.resolve([SAMPLE_ITEMS[1], SAMPLE_ITEMS[2]]);
      expect(await p1).toEqual({ status: 'stale' });

      const state = notificationStoreManager.getOrCreateState('user-epoch');
      expect(state.notifications).toEqual([SAMPLE_ITEMS[0]]);
    });
  });

  describe('store-owned seenUnreadCount clamping', () => {
    it('clamps persisted seenUnreadCount down to actual unreadCountState once settled, but never during loading or pending optimistic mutations', async () => {
      localStorage.setItem('notif_seen_unread_count_user-clamp', '7');

      // 1. Loading status: must NOT clamp
      notificationStoreManager.configure('user-clamp', {
        initialNotifications: [],
        initialStatus: 'loading',
      });
      expect(localStorage.getItem('notif_seen_unread_count_user-clamp')).toBe(
        '7'
      );

      // 2. Settled success with 2 unread: clamps 7 -> 2
      notificationStoreManager.configure('user-clamp', {
        initialNotifications: SAMPLE_ITEMS,
        initialStatus: 'success',
      });
      expect(
        notificationStoreManager.getOrCreateState('user-clamp').seenUnreadCount
      ).toBe(2);
      expect(localStorage.getItem('notif_seen_unread_count_user-clamp')).toBe(
        '2'
      );

      // 3. Failed optimistic markAllRead: must NOT clamp seenUnreadCount to 0 during flight
      const deferredMarkAll = createDeferred<void>();
      const failingSource: NotificationSource = {
        requiresAuth: false,
        isPreloaded: false,
        getUnreadCount: async () => ({ unread_count: 2 }),
        listNotifications: async () => ({
          notifications: SAMPLE_ITEMS,
          next_cursor: null,
        }),
        markOneRead: async () => {},
        markAllRead: () => deferredMarkAll.promise,
      };
      notificationStoreManager.setSource('user-clamp', failingSource);

      const markAllPromise = notificationStoreManager.markAllRead('user-clamp');
      expect(
        notificationStoreManager.getOrCreateState('user-clamp').unreadCountState
      ).toBe(0);
      expect(localStorage.getItem('notif_seen_unread_count_user-clamp')).toBe(
        '2'
      );

      deferredMarkAll.reject(new Error('network fail'));
      const outcome = await markAllPromise;
      expect(outcome.status).toBe('failed');
      expect(
        notificationStoreManager.getOrCreateState('user-clamp').unreadCountState
      ).toBe(2);
      expect(localStorage.getItem('notif_seen_unread_count_user-clamp')).toBe(
        '2'
      );
    });

    it('advances seenUnreadCount when unread count increases while a non-preloaded panel is open', async () => {
      const panelInstance = Symbol('desktop-panel');
      const source = createInMemoryNotificationSource(SAMPLE_ITEMS, {
        unreadCountOverride: 4,
      });
      notificationStoreManager.configure('user-open', { source });

      await notificationStoreManager.openPanel('user-open', panelInstance);

      const state = notificationStoreManager.getOrCreateState('user-open');
      expect(state.unreadCountState).toBe(4);
      expect(state.seenUnreadCount).toBe(4);
      expect(localStorage.getItem('notif_seen_unread_count_user-open')).toBe(
        '4'
      );

      notificationStoreManager.closePanel('user-open', panelInstance);
    });
  });
});
