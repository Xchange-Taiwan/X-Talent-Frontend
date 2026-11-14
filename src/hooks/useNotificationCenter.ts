import * as React from 'react';

import { useToast } from '@/components/ui/use-toast';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import {
  createFixtureNotificationSource,
  type NotificationSource,
} from '@/services/notifications/notificationSource';
import type { NotificationItem } from '@/services/notifications/types';
import {
  createInitialState,
  type NotificationStatus,
  notificationStoreManager,
} from '@/stores/notificationStore';

export type { NotificationItem };

export type UseNotificationCenterProps = {
  userId?: string;
  initialStatus?: NotificationStatus;
  initialNotifications?: NotificationItem[];
  notificationSource?: NotificationSource;
};

export function useNotificationCenter({
  userId,
  initialStatus = 'success',
  initialNotifications,
  notificationSource,
}: UseNotificationCenterProps = {}) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);

  const instanceIdRef = React.useRef<symbol | null>(null);
  if (instanceIdRef.current === null) {
    instanceIdRef.current = Symbol('notification-center-instance');
  }
  const instanceId = instanceIdRef.current;

  const explicitSource = React.useMemo(() => {
    if (notificationSource !== undefined) {
      return notificationSource;
    }
    if (initialNotifications !== undefined) {
      return createFixtureNotificationSource(initialNotifications);
    }
    return undefined;
  }, [notificationSource, initialNotifications]);

  const [serverSnapshot] = React.useState(() =>
    createInitialState(userId, initialNotifications, initialStatus)
  );

  const storeState = React.useSyncExternalStore(
    React.useCallback(
      (callback) => {
        const unsubscribe = notificationStoreManager.subscribe(
          userId,
          callback
        );
        return () => {
          notificationStoreManager.closePanel(userId, instanceId);
          unsubscribe();
        };
      },
      [userId, instanceId]
    ),
    React.useCallback(
      () =>
        notificationStoreManager.getOrCreateState(
          userId,
          initialNotifications,
          initialStatus
        ),
      [userId, initialNotifications, initialStatus]
    ),
    React.useCallback(() => serverSnapshot, [serverSnapshot])
  );

  useIsomorphicLayoutEffect(() => {
    notificationStoreManager.configure(userId, {
      source: explicitSource,
      initialNotifications,
      initialStatus,
    });
  }, [userId, explicitSource, initialNotifications, initialStatus]);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadedUnreadCount = React.useMemo(() => {
    return storeState.notifications.filter((item) => item.unread).length;
  }, [storeState.notifications]);

  const badgeCount = storeState.unreadCountState;
  const hasMore = storeState.nextCursor !== null;
  const olderUnreadCount = hasMore
    ? Math.max(badgeCount - loadedUnreadCount, 0)
    : 0;

  const loadMore = React.useCallback(
    async (isRetry = false) => {
      const result = await notificationStoreManager.loadMore(userId, isRetry);
      if (result.status === 'failed') {
        console.error('[useNotificationCenter] loadMore failed:', result.error);
        toast({
          variant: 'destructive',
          title: '載入失敗',
          description: '無法載入更多通知，請點擊重試',
        });
      }
    },
    [userId, toast]
  );

  const openCenter = React.useCallback(() => {
    setOpen(true);
    void notificationStoreManager
      .openPanel(userId, instanceId)
      .then((result) => {
        if (result.status === 'failed' && result.hadCachedNotifications) {
          toast({
            variant: 'destructive',
            title: '更新失敗',
            description: '無法更新最新通知，請稍後再試',
          });
        }
      });
  }, [userId, instanceId, toast]);

  const closeCenter = React.useCallback(() => {
    setOpen(false);
    notificationStoreManager.closePanel(userId, instanceId);
  }, [userId, instanceId]);

  const onOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        openCenter();
      } else {
        closeCenter();
      }
    },
    [openCenter, closeCenter]
  );

  const markRead = React.useCallback(
    async (id: string) => {
      const result = await notificationStoreManager.markRead(userId, id);
      if (result.status === 'failed') {
        toast({
          variant: 'destructive',
          title: '操作失敗',
          description: '無法將通知標示為已讀，請稍後再試',
        });
      }
    },
    [userId, toast]
  );

  const markAllReadAction = React.useCallback(async () => {
    const result = await notificationStoreManager.markAllRead(userId);
    if (result.status === 'failed') {
      toast({
        variant: 'destructive',
        title: '操作失敗',
        description: '無法將全部通知標示為已讀，請稍後再試',
      });
    }
  }, [userId, toast]);

  const handleRetry = React.useCallback(() => {
    void notificationStoreManager.retry(userId);
  }, [userId]);

  const showBadge = isMounted && badgeCount > storeState.seenUnreadCount;
  const formattedCount = badgeCount > 99 ? '99+' : String(badgeCount);
  const hasUnread = badgeCount > 0;

  return {
    open,
    status: storeState.status,
    items: storeState.notifications,
    badgeCount,
    showBadge,
    formattedCount,
    hasUnread,
    openCenter,
    closeCenter,
    onOpenChange,
    markRead,
    markAllRead: markAllReadAction,
    handleRetry,
    isLoadingMore: storeState.isLoadingMore,
    hasMore,
    loadMore,
    hasLoadMoreError: storeState.hasLoadMoreError,
    olderUnreadCount,
  };
}
