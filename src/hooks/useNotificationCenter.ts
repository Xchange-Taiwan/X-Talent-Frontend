import { usePathname } from 'next/navigation';
import { SessionContext } from 'next-auth/react';
import * as React from 'react';

import { useToast } from '@/components/ui/use-toast';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import {
  createInitialState,
  type NotificationItem,
  notificationReadModel,
  type NotificationSource,
  type NotificationStatus,
  projectNotificationCenterView,
  resolveNotificationUserId,
} from '@/lib/notifications';

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

  const sessionContext = React.useContext(SessionContext);
  const pathname = usePathname();
  const effectiveUserId = resolveNotificationUserId({
    userId,
    enabled,
    pathname,
    isIncompleteOnboarding:
      sessionContext?.status === 'authenticated' &&
      sessionContext.data?.user?.onBoarding === false,
    hasExplicitSource:
      notificationSource !== undefined || initialNotifications !== undefined,
  });

  const serverSnapshot = React.useMemo(
    () =>
      createInitialState(effectiveUserId, initialNotifications, initialStatus),
    [effectiveUserId, initialNotifications, initialStatus]
  );

  const storeState = React.useSyncExternalStore(
    React.useCallback(
      (callback) => {
        const unsubscribe = notificationReadModel.subscribe(
          effectiveUserId,
          callback
        );
        return () => {
          notificationReadModel.closePanel(effectiveUserId, instanceId);
          unsubscribe();
        };
      },
      [effectiveUserId, instanceId]
    ),
    React.useCallback(
      () =>
        notificationReadModel.getOrCreateState(
          effectiveUserId,
          initialNotifications,
          initialStatus
        ),
      [effectiveUserId, initialNotifications, initialStatus]
    ),
    React.useCallback(() => serverSnapshot, [serverSnapshot])
  );

  useIsomorphicLayoutEffect(() => {
    notificationReadModel.configure(effectiveUserId, {
      source: notificationSource,
      initialNotifications,
      initialStatus,
    });
  }, [
    effectiveUserId,
    notificationSource,
    initialNotifications,
    initialStatus,
  ]);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadMore = React.useCallback(
    async (isRetry = false) => {
      const result = await notificationReadModel.loadMore(
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
    void notificationReadModel
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
    notificationReadModel.closePanel(effectiveUserId, instanceId);
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
      const result = await notificationReadModel.markRead(effectiveUserId, id);
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

  const markAllRead = React.useCallback(async () => {
    const result = await notificationReadModel.markAllRead(effectiveUserId);
    if (result.status === 'failed') {
      toast({
        variant: 'destructive',
        title: '操作失敗',
        description: '無法將全部通知標示為已讀，請稍後再試',
      });
    }
  }, [effectiveUserId, toast]);

  const handleRetry = React.useCallback(() => {
    void notificationReadModel.retry(effectiveUserId);
  }, [effectiveUserId]);

  const view = projectNotificationCenterView(storeState, isMounted);

  return {
    open,
    status: storeState.status,
    items: storeState.notifications,
    ...view,
    openCenter,
    closeCenter,
    onOpenChange,
    markRead,
    markAllRead,
    handleRetry,
    isLoadingMore: storeState.isLoadingMore,
    loadMore,
    hasLoadMoreError: storeState.hasLoadMoreError,
  };
}
