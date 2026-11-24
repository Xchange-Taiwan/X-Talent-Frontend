import { useCallback, useState, useSyncExternalStore } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { createReservationMeetJoiner } from '@/lib/reservation/joinReservationMeet';

export interface UseReservationMeetLinkProps {
  myUserId?: string | number;
}

/**
 * Thin React adapter over `createReservationMeetJoiner` (X-Tracker #978):
 * exposes the joiner's single-flight state as `isPending` and maps failed
 * results onto destructive toasts.
 */
export function useReservationMeetLink({
  myUserId,
}: UseReservationMeetLinkProps = {}) {
  const { toast } = useToast();
  const [joiner] = useState(() => createReservationMeetJoiner());
  const isPending = useSyncExternalStore(
    joiner.subscribe,
    joiner.isPending,
    () => false
  );

  const joinMeet = useCallback(
    async (reservationId: string) => {
      const result = await joiner.join({ userId: myUserId, reservationId });
      if (result.status !== 'failed') return;
      const { title, description } = result;
      toast({ variant: 'destructive', title, description });
    },
    [joiner, myUserId, toast]
  );

  return { joinMeet, isPending };
}
