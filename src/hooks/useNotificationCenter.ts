import { usePathname } from 'next/navigation';
import { SessionContext } from 'next-auth/react';
import * as React from 'react';

import { useToast } from '@/components/ui/use-toast';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { ONBOARDING_HREF } from '@/lib/routes';
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
  enabled?: boolean;
  initialStatus?: NotificationStatus;
  initialNotifications?: NotificationItem[];
  notificationSource?: NotificationSource;
};

export function useNotificationCenter({
  userId,
  enabled = true,
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

  const sessionContext = React.useContext(SessionContext);
  const pathname = usePathname();
  const isIncompleteOnboarding =
    sessionContext?.status === 'authenticated' &&
    sessionContext.data?.user?.onBoarding === false;
  const isOnboardingRoute = Boolean(
    pathname &&
    (pathname === ONBOARDING_HREF || pathname.startsWith(`${ONBOARDING_HREF}/`))
  );
  const effectiveUserId =
    !enabled ||
    (explicitSource === undefined &&
      (isIncompleteOnboarding || isOnboardingRoute))
      ? undefined
      : userId;

  const serverSnapshot = React.useMemo(
    () =>
      createInitialState(effectiveUserId, initialNotifications, initialStatus),
    [effectiveUserId, initialNotifications, initialStatus]
  );

  const storeState = React.useSyncExternalStore(
    React.useCallback(
      (callback) => {
        const unsubscribe = notificationStoreManager.subscribe(
          effectiveUserId,
          callback
        );
        return () => {
          notificationStoreManager.closePanel(effectiveUserId, instanceId);
          unsubscribe();
        };
      },
      [effectiveUserId, instanceId]
    ),
    React.useCallback(
      () =>
        notificationStoreManager.getOrCreateState(
          effectiveUserId,
          initialNotifications,
          initialStatus
        ),
      [effectiveUserId, initialNotifications, initialStatus]
    ),
    React.useCallback(() => serverSnapshot, [serverSnapshot])
  );

  useIsomorphicLayoutEffect(() => {
    notificationStoreManager.configure(effectiveUserId, {
      source: explicitSource,
      initialNotifications,
      initialStatus,
    });
  }, [effectiveUserId, explicitSource, initialNotifications, initialStatus]);

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
      const result = await notificationStoreManager.loadMore(
        effectiveUserId,
        isRetry
      );
      if (result.status === 'failed') {
        console.error('[useNotificationCenter] loadMore failed:', result.error);
        toast({
          variant: 'destructive',
          title: '載入失敗',
          description: '無法載入更多通知，請點擊重試',
        });
      }
    },
    [effectiveUserId, toast]
  );

  const openCenter = React.useCallback(() => {
    setOpen(true);
    void notificationStoreManager
      .openPanel(effectiveUserId, instanceId)
      .then((result) => {
        if (result.status === 'failed' && result.hadCachedNotifications) {
          toast({
            variant: 'destructive',
            title: '更新失敗',
            description: '無法更新最新通知，請稍後再試',
          });
        }
      });
  }, [effectiveUserId, instanceId, toast]);

  const closeCenter = React.useCallback(() => {
    setOpen(false);
    notificationStoreManager.closePanel(effectiveUserId, instanceId);
  }, [effectiveUserId, instanceId]);

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
      const result = await notificationStoreManager.markRead(
        effectiveUserId,
        id
      );
      if (result.status === 'failed') {
        toast({
          variant: 'destructive',
          title: '操作失敗',
          description: '無法將通知標示為已讀，請稍後再試',
        });
      }
    },
    [effectiveUserId, toast]
  );

  const markAllReadAction = React.useCallback(async () => {
    const result = await notificationStoreManager.markAllRead(effectiveUserId);
    if (result.status === 'failed') {
      toast({
        variant: 'destructive',
        title: '操作失敗',
        description: '無法將全部通知標示為已讀，請稍後再試',
      });
    }
  }, [effectiveUserId, toast]);

  const handleRetry = React.useCallback(() => {
    void notificationStoreManager.retry(effectiveUserId);
  }, [effectiveUserId]);

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
