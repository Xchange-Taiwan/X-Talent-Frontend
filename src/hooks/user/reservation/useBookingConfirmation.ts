import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { BookingSlot } from '@/hooks/useMentorSchedule';
import { UserType } from '@/hooks/user/user-data/useUserData';
import { trackEvent } from '@/lib/analytics';
import { FetchApiError } from '@/lib/apiClient';
import { captureFlowFailure } from '@/lib/monitoring';
import { createReservation } from '@/services/reservations';

interface UseBookingConfirmationParams {
  loginUserId: string | null;
  userData: UserType | null | undefined;
  selectedSlot: BookingSlot | null;
  setSelectedSlot: (slot: BookingSlot | null) => void;
}

export function useBookingConfirmation({
  loginUserId,
  userData,
  selectedSlot,
  setSelectedSlot,
}: UseBookingConfirmationParams) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirmReservation = useCallback(
    async (question?: string): Promise<boolean> => {
      if (!loginUserId) {
        router.push('/auth/signin');
        return false;
      }
      if (!selectedSlot || !userData) return false;

      setIsSubmitting(true);
      try {
        const menteeId = Number(loginUserId);
        const trimmedQuestion = question?.trim() ?? '';
        const messages = trimmedQuestion
          ? [{ user_id: menteeId, content: trimmedQuestion }]
          : [];

        await createReservation({
          userId: menteeId,
          body: {
            my_user_id: menteeId,
            my_status: 'PENDING',
            user_id: userData.user_id,
            schedule_id: selectedSlot.scheduleId,
            dtstart: Math.floor(selectedSlot.start.getTime() / 1000),
            dtend: Math.floor(selectedSlot.end.getTime() / 1000),
            messages,
          },
          debug: process.env.NODE_ENV === 'development',
        });

        trackEvent({
          name: 'reservation_booking_confirmed',
          feature: 'reservation',
        });

        toast({
          title: '預約已送出，等待導師回復',
          description: '導師接受後預約才會成立，可至「我的預約」追蹤狀態。',
        });

        setSelectedSlot(null);
        return true;
      } catch (error) {
        console.error('Failed to create reservation:', error);

        const isDuplicate =
          error instanceof FetchApiError && error.code === '409';
        const msg = error instanceof Error ? error.message : 'Unknown error';

        captureFlowFailure({
          flow: 'reservation_create',
          step: 'create_reservation',
          message: msg,
          ...(isDuplicate ? { level: 'info' as const } : {}),
        });

        if (isDuplicate) {
          toast({
            title: '預約時間重疊',
            description: '該時段您已有其他預約，請重新選擇其他時段。',
            variant: 'destructive',
          });
        } else {
          toast({
            title: '預約失敗',
            description: msg,
            variant: 'destructive',
          });
        }
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [loginUserId, selectedSlot, userData, setSelectedSlot, router, toast]
  );

  return {
    isSubmitting,
    handleConfirmReservation,
  };
}
