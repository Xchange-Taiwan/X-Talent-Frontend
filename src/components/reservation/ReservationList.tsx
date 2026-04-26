'use client';

import { getSession, useSession } from 'next-auth/react';

import AcceptReservationDialog from '@/components/reservation/AcceptReservationDialog';
import CancelReservationDialog from '@/components/reservation/CancelReservationDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { trackEvent } from '@/lib/analytics';
import { captureFlowFailure } from '@/lib/monitoring';
import { updateReservationStatus } from '@/services/reservations';

import { ReservationCard } from './ReservationCard';
import type { Reservation } from './types';

type Variant = 'upcoming' | 'pending-mentee' | 'pending-mentor' | 'history';
type SourceRole = 'mentor' | 'mentee';

export function ReservationList({
  items,
  variant,
  sourceRole,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
}: {
  items: Reservation[];
  variant: Variant;
  sourceRole: SourceRole;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}) {
  const { toast } = useToast();
  const { data: session } = useSession();
  const myId = session?.user?.id ? String(session.user.id) : '';

  const findItem = (id: string): Reservation => {
    const found = items.find((x) => x.id === id);
    if (!found)
      throw new Error(`[ReservationList] item not found for id=${id}`);
    return found;
  };

  // Resolve the other party's user_id based on who is currently logged in
  const resolveOtherId = (myId: string, it: Reservation): string | number =>
    String(it.senderUserId) === myId ? it.participantUserId : it.senderUserId;

  // Hard reload the page to reflect updated reservation state.
  // Delayed so the success toast has time to render before the page reloads.
  const hardReload = () => {
    if (typeof window === 'undefined') return;
    setTimeout(() => window.location.reload(), 800);
  };

  // Accept a booking request (mentor side, pending-mentor variant)
  const accept = async ({ id, message }: { id: string; message: string }) => {
    try {
      const session = await getSession();
      const myId = String(session?.user?.id ?? '');
      if (!myId) throw new Error('[ReservationList] missing current user id');

      const it = findItem(id);
      const otherId = resolveOtherId(myId, it);

      await updateReservationStatus({
        userId: myId,
        reservationId: id,
        body: {
          my_user_id: myId,
          user_id: otherId,
          my_status: 'ACCEPT',
          schedule_id: it.scheduleId,
          dtstart: it.dtstart,
          dtend: it.dtend,
          messages: message.trim()
            ? [{ user_id: myId, content: message.trim() }]
            : [],
          previous_reserve: {},
        },
      });

      // TODO: block the accepted time slot so other mentees can't book it.
      // Blocked by backend: PUT /mentors/:id/schedule returns 422 when a BLOCK
      // slot overlaps an existing ALLOW slot. Re-enable once backend supports it,
      // or once GET schedule returns booked_slots so the frontend can filter them.

      trackEvent({ name: 'reservation_accepted', feature: 'reservation' });
      toast({ description: '已接受預約' });
      hardReload();
    } catch (err) {
      captureFlowFailure({
        flow: 'reservation_accept',
        step: 'update_status',
        message:
          err instanceof Error ? err.message : 'Failed to accept reservation',
      });
      throw err;
    }
  };

  // Shared handler for both reject and cancel (same API call)
  const rejectOrCancel = async (
    id: string,
    text: string,
    successMessage: string
  ) => {
    try {
      const session = await getSession();
      const myId = String(session?.user?.id ?? '');
      if (!myId) throw new Error('[ReservationList] missing current user id');

      const it = findItem(id);
      const otherId = resolveOtherId(myId, it);

      await updateReservationStatus({
        userId: myId,
        reservationId: id,
        body: {
          my_user_id: myId,
          user_id: otherId,
          my_status: 'REJECT',
          schedule_id: it.scheduleId,
          dtstart: it.dtstart,
          dtend: it.dtend,
          messages: text.trim()
            ? [{ user_id: myId, content: text.trim() }]
            : [],
          previous_reserve: {},
        },
      });

      // TODO: remove the BLOCK slot when cancelling an accepted reservation.
      // Blocked by the same backend limitation as above.

      trackEvent({ name: 'reservation_rejected', feature: 'reservation' });
      toast({ description: successMessage });
      hardReload();
    } catch (err) {
      captureFlowFailure({
        flow: 'reservation_reject',
        step: 'update_status',
        message:
          err instanceof Error
            ? err.message
            : 'Failed to reject/cancel reservation',
      });
      throw err;
    }
  };

  // Build a profile link to the *other* party. Skip when we don't have
  // a logged-in user (link would be ambiguous) or when the other id would
  // resolve to the current user (defensive — shouldn't happen in practice).
  const buildProfileHref = (it: Reservation): string | undefined => {
    if (!myId) return undefined;
    const otherId = resolveOtherId(myId, it);
    if (!otherId || String(otherId) === myId) return undefined;
    return `/profile/${otherId}`;
  };

  const handleProfileClick = (): void => {
    trackEvent({
      name: 'reservation_profile_viewed',
      feature: 'reservation',
      metadata: { source_role: sourceRole },
    });
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {items.map((it) => (
        <ReservationCard
          key={it.id}
          item={it}
          profileHref={buildProfileHref(it)}
          onProfileClick={handleProfileClick}
          actions={
            variant === 'history' ? null : variant === 'pending-mentor' ? (
              <AcceptReservationDialog
                reservation={it}
                onAccept={accept}
                onReject={async ({ id, reason }) =>
                  rejectOrCancel(id, reason, '已拒絕預約')
                }
              />
            ) : (
              <CancelReservationDialog
                reservation={it}
                onConfirmCancel={async ({ id, reason }) =>
                  rejectOrCancel(id, reason, '已取消預約')
                }
              />
            )
          }
        />
      ))}

      {items.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-muted-foreground">
            目前尚無資料
          </CardContent>
        </Card>
      )}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? '載入中...' : '載入更多'}
          </Button>
        </div>
      )}
    </div>
  );
}
