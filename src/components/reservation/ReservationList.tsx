'use client';

import AcceptReservationDialog from '@/components/reservation/AcceptReservationDialog';
import CancelReservationDialog from '@/components/reservation/CancelReservationDialog';
import RejectReservationDialog from '@/components/reservation/RejectReservationDialog';
import ReservationConversationDialog from '@/components/reservation/ReservationConversationDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useReservationActions } from '@/hooks/user/reservation/useReservationActions';
import { ListKey } from '@/hooks/user/reservation/useReservationData';
import { trackEvent } from '@/lib/analytics';
import { resolveCounterpartyId } from '@/lib/reservation/resolveCounterparty';
import type { Reservation } from '@/types/reservation';

import {
  ReservationCard,
  type ReservationCardVariant,
} from './ReservationCard';

type Variant = 'upcoming' | 'pending-mentee' | 'pending-mentor' | 'history';
type SourceRole = 'mentor' | 'mentee';

const cardVariantOf = (variant: Variant): ReservationCardVariant =>
  variant === 'upcoming'
    ? 'upcoming'
    : variant === 'history'
      ? 'history'
      : 'pending';

/**
 * Individual Reservation List Item holding its own independent loading and action state.
 */
function ReservationItem({
  reservation,
  variant,
  sourceRole,
  myUserId,
  onMutationSuccess,
  onVersionConflict,
}: {
  reservation: Reservation;
  variant: Variant;
  sourceRole: SourceRole;
  myUserId: string | undefined;
  onMutationSuccess?: (id: string, affectedTabs: ListKey[]) => void;
  onVersionConflict?: (affectedTabs: ListKey[]) => void;
}) {
  const { accept, rejectOrCancel, isMutating } = useReservationActions({
    myUserId,
    variant,
    onMutationSuccess,
    onVersionConflict,
  });

  const handleProfileClick = (): void => {
    trackEvent({
      name: 'reservation_profile_viewed',
      feature: 'reservation',
      metadata: { source_role: sourceRole },
    });
  };

  // Build a profile link to the *other* party. Skip when we don't have
  // a logged-in user (link would be ambiguous) or when the other id would
  // resolve to the current user (defensive — shouldn't happen in practice).
  const buildProfileHref = (item: Reservation): string | undefined => {
    if (!myUserId) return undefined;
    const otherId = resolveCounterpartyId(item, myUserId);
    if (!otherId || String(otherId) === myUserId) return undefined;
    return `/profile/${otherId}`;
  };

  return (
    <ReservationCard
      item={reservation}
      myUserId={myUserId}
      variant={cardVariantOf(variant)}
      profileHref={buildProfileHref(reservation)}
      onProfileClick={handleProfileClick}
      actions={
        variant === 'history' ? (
          reservation.cancelledBy ? (
            <Badge variant="secondary" role="status">
              已由{reservation.cancelledBy === 'MENTOR' ? '導師' : '學員'}取消
            </Badge>
          ) : null
        ) : variant === 'pending-mentor' ? (
          <div className="flex gap-2">
            <RejectReservationDialog
              reservation={reservation}
              disabled={isMutating}
              onReject={async ({ reason }) =>
                rejectOrCancel(reservation, reason, 'reject')
              }
            />
            <AcceptReservationDialog
              reservation={reservation}
              disabled={isMutating}
              onAccept={async ({ message }) => accept(reservation, message)}
            />
          </div>
        ) : (
          <CancelReservationDialog
            reservation={reservation}
            disabled={isMutating}
            onConfirmCancel={async ({ reason }) =>
              rejectOrCancel(reservation, reason, 'cancel')
            }
          />
        )
      }
      footer={
        variant === 'history' && reservation.messages.length > 0 ? (
          <ReservationConversationDialog
            reservation={reservation}
            sourceRole={sourceRole}
          />
        ) : null
      }
    />
  );
}

export function ReservationList({
  items,
  variant,
  sourceRole,
  myUserId,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  onMutationSuccess,
  onVersionConflict,
}: {
  items: Reservation[];
  variant: Variant;
  sourceRole: SourceRole;
  myUserId: string | undefined;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  // Called after a successful accept / reject / cancel so the parent hook can
  // optimistically remove the operated item and refetch only the affected
  // states in the background.
  onMutationSuccess?: (id: string, affectedTabs: ListKey[]) => void;
  // Called once when a status update is rejected with a 409 version
  // conflict, so the parent hook can refetch the affected tabs in place.
  onVersionConflict?: (affectedTabs: ListKey[]) => void;
}) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {items.map((it) => (
        <ReservationItem
          key={it.id}
          reservation={it}
          variant={variant}
          sourceRole={sourceRole}
          myUserId={myUserId}
          onMutationSuccess={onMutationSuccess}
          onVersionConflict={onVersionConflict}
        />
      ))}

      {items.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-text-tertiary">
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
