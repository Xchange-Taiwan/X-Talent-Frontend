import { useCallback } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { ApiError } from '@/lib/apiClient';
import { fetchReservationMeetLink } from '@/services/reservations';

export interface UseReservationMeetLinkProps {
  myUserId?: string | number;
}

export function useReservationMeetLink({
  myUserId,
}: UseReservationMeetLinkProps = {}) {
  const { toast } = useToast();
  const { run, isPending } = useAsyncAction({
    throwError: true,
  });

  const joinMeet = useCallback(
    async (reservationId: string) => {
      if (!myUserId) {
        toast({
          variant: 'destructive',
          title: '錯誤',
          description: '無法取得目前使用者資訊，請重新登入。',
        });
        return;
      }

      // 先同步 window.open() 開一個空白分頁（避免被瀏覽器彈窗攔截阻擋）
      const newTab = window.open('about:blank', '_blank');

      try {
        await run(async () => {
          const data = await fetchReservationMeetLink({
            userId: myUserId,
            reservationId,
          });

          if (data.meet_url) {
            // 安全驗證：確保網址為安全的 Google Meet 相關網域
            if (
              data.meet_url.startsWith('https://meet.google.com/') ||
              data.meet_url.startsWith('https://calendar.google.com/')
            ) {
              if (newTab) {
                newTab.location.href = data.meet_url;
              } else {
                window.location.href = data.meet_url;
              }
            } else {
              throw new Error('不安全的會議連結');
            }
          } else {
            if (newTab) newTab.close();
            toast({
              variant: 'destructive',
              title: '找不到會議連結',
              description: '此預約尚未就緒，或會議連結不存在。',
            });
          }
        });
      } catch (err) {
        if (newTab) newTab.close();

        // 忽略快速連點防護拋出的 ConcurrentActionError
        if (
          err &&
          typeof err === 'object' &&
          'name' in err &&
          err.name === 'ConcurrentActionError'
        ) {
          return;
        }

        let errMsg = '取得會議連結失敗，請稍後再試。';
        const codeOrStatus =
          err instanceof ApiError ? String(err.status) : undefined;

        if (codeOrStatus === '404') {
          errMsg = '連結尚未就緒或不存在（會議狀態需為已排程）。';
        } else if (codeOrStatus === '403') {
          errMsg = '您並非此預約的導師或學員，無法加入。';
        }

        toast({
          variant: 'destructive',
          title: '錯誤',
          description: errMsg,
        });
      }
    },
    [run, myUserId, toast]
  );

  return {
    joinMeet,
    isPending,
  };
}
