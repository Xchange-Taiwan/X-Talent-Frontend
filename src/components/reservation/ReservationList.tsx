'use client';

import AcceptReservationDialog from '@/components/reservation/AcceptReservationDialog';
import CancelReservationDialog from '@/components/reservation/CancelReservationDialog';
import RejectReservationDialog from '@/components/reservation/RejectReservationDialog';
import ReservationConversationDialog from '@/components/reservation/ReservationConversationDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { trackEvent } from '@/lib/analytics';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  ReservationState,
  updateReservationStatus,
} from '@/services/reservations';

import { ReservationCard } from './ReservationCard';
import type { Reservation } from './types';

type Variant = 'upcoming' | 'pending-mentee' | 'pending-mentor' | 'history';
type SourceRole = 'mentor' | 'mentee';

export function ReservationList({
  items,
  variant,
  sourceRole,
  myUserId,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  onMutationSuccess,
}: {
  items: Reservation[];
  variant: Variant;
  sourceRole: SourceRole;
  myUserId: string;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  // Called after a successful accept / reject / cancel so the parent hook can
  // optimistically remove the operated item and refetch only the affected
  // states in the background.
  onMutationSuccess?: (id: string, affectedStates: ReservationState[]) => void;
}) {
  const { toast } = useToast();

  // Accept on pending-mentor: pending-mentor → upcoming-mentor.
  const ACCEPT_AFFECTED_STATES: ReservationState[] = [
    'MENTOR_PENDING',
    'MENTOR_UPCOMING',
  ];

  // Reject / cancel always lands the reservation in the role's HISTORY list.
  // The source state depends on the variant.
  const buildRejectOrCancelAffectedStates = (): ReservationState[] => {
    const upper = sourceRole === 'mentor' ? 'MENTOR' : 'MENTEE';
    const history = `${upper}_HISTORY` as ReservationState;
    if (variant === 'upcoming')
      return [`${upper}_UPCOMING` as ReservationState, history];
    if (variant === 'pending-mentor') return ['MENTOR_PENDING', history];
    if (variant === 'pending-mentee') return ['MENTEE_PENDING', history];
    return [];
  };

  const findItem = (id: string): Reservation => {
    const found = items.find((x) => x.id === id);
    if (!found)
      throw new Error(`[ReservationList] item not found for id=${id}`);
    return found;
  };

  // Resolve the other party's user_id based on who is currently logged in
  const resolveOtherId = (it: Reservation): string | number =>
    String(it.senderUserId) === myUserId
      ? it.participantUserId
      : it.senderUserId;

  // Accept a booking request (mentor side, pending-mentor variant)
  const accept = async ({ id, message }: { id: string; message: string }) => {
    try {
      if (!myUserId)
        throw new Error('[ReservationList] missing current user id');
      const myIdNum = Number(myUserId);

      const it = findItem(id);
      const otherIdNum = Number(resolveOtherId(it));

      await updateReservationStatus({
        userId: myUserId,
        reservationId: id,
        body: {
          my_user_id: myIdNum,
          user_id: otherIdNum,
          my_status: 'ACCEPT',
          schedule_id: it.scheduleId,
          dtstart: it.dtstart,
          dtend: it.dtend,
          messages: message.trim()
            ? [{ user_id: myIdNum, content: message.trim() }]
            : [],
        },
      });

      // TODO: block the accepted time slot so other mentees can't book it.
      // Blocked by backend: PUT /mentors/:id/schedule returns 422 when a BLOCK
      // slot overlaps an existing ALLOW slot. Re-enable once backend supports it,
      // or once GET schedule returns booked_slots so the frontend can filter them.

      toast({
        title: '已接受預約',
        description: '會議連結將於數分鐘內寄至雙方信箱',
      });
      onMutationSuccess?.(id, ACCEPT_AFFECTED_STATES);
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
      if (!myUserId)
        throw new Error('[ReservationList] missing current user id');
      const myIdNum = Number(myUserId);

      const it = findItem(id);
      const otherIdNum = Number(resolveOtherId(it));

      await updateReservationStatus({
        userId: myUserId,
        reservationId: id,
        body: {
          my_user_id: myIdNum,
          user_id: otherIdNum,
          my_status: 'REJECT',
          schedule_id: it.scheduleId,
          dtstart: it.dtstart,
          dtend: it.dtend,
          messages: text.trim()
            ? [{ user_id: myIdNum, content: text.trim() }]
            : [],
        },
      });

      // TODO: remove the BLOCK slot when cancelling an accepted reservation.
      // Blocked by the same backend limitation as above.

      trackEvent({ name: 'reservation_rejected', feature: 'reservation' });
      toast({ description: successMessage });
      onMutationSuccess?.(id, buildRejectOrCancelAffectedStates());
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
    if (!myUserId) return undefined;
    const otherId = resolveOtherId(it);
    if (!otherId || String(otherId) === myUserId) return undefined;
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
            variant === 'history' ? (
              it.cancelledBy ? (
                <Badge variant="secondary" role="status">
                  已由{it.cancelledBy === 'MENTOR' ? '導師' : '學員'}取消
                </Badge>
              ) : null
            ) : variant === 'pending-mentor' ? (
              <div className="flex gap-2">
                <RejectReservationDialog
                  reservation={it}
                  onReject={async ({ id, reason }) =>
                    rejectOrCancel(id, reason, '已拒絕預約')
                  }
                />
                <AcceptReservationDialog reservation={it} onAccept={accept} />
              </div>
            ) : (
              <CancelReservationDialog
                reservation={it}
                onConfirmCancel={async ({ id, reason }) =>
                  rejectOrCancel(id, reason, '已取消預約')
                }
              />
            )
          }
          footer={
            variant === 'history' && it.messages.length > 0 ? (
              <ReservationConversationDialog
                reservation={it}
                sourceRole={sourceRole}
              />
            ) : null
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
