'use client';

import type * as React from 'react';

import AcceptReservationDialog from '@/components/reservation/AcceptReservationDialog';
import CancelReservationDialog from '@/components/reservation/CancelReservationDialog';
import RejectReservationDialog from '@/components/reservation/RejectReservationDialog';
import ReservationConversationDialog from '@/components/reservation/ReservationConversationDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useProfileLinkClick } from '@/hooks/reservation/useProfileLinkClick';
import { useReservationActions } from '@/hooks/user/reservation/useReservationActions';
import type { MutationAffectedTabs } from '@/hooks/user/reservation/useReservationData';
import { trackEvent } from '@/lib/analytics';
import { resolveReservationViewer } from '@/lib/reservation/reservationViewerModel';
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
  onMutationSuccess?: (
    id: string,
    affected: MutationAffectedTabs | null
  ) => void;
  onVersionConflict?: (affected: MutationAffectedTabs | null) => void;
}) {
  const { accept, rejectOrCancel, isMutating } = useReservationActions({
    myUserId,
    variant,
    myRole: sourceRole,
    onMutationSuccess,
    onVersionConflict,
  });

  const viewer = resolveReservationViewer({
    reservation,
    myUserId,
  });

  const handleProfileLinkInvalidation = useProfileLinkClick({
    disabled: isMutating,
  });

  // Tracked unconditionally on every non-disabled click, including a
  // modifier-key/middle click that opens a new tab - the click-invalidation
  // above only governs whether the link navigates in this render, not
  // whether the view was attempted. Matches this list's pre-model behavior,
  // which tracked every click with no modifier check at all.
  const handleProfileClick = (e: React.MouseEvent): void => {
    if (!isMutating) {
      trackEvent({
        name: 'reservation_profile_viewed',
        feature: 'reservation',
        metadata: { source_role: sourceRole },
      });
    }
    handleProfileLinkInvalidation(e);
  };

  return (
    <ReservationCard
      item={reservation}
      myUserId={myUserId}
      variant={cardVariantOf(variant)}
      profileHref={viewer.profileHref}
      onProfileClick={handleProfileClick}
      disabled={isMutating}
      sourceRole={sourceRole}
      actions={
        variant === 'history' ? (
          viewer.cancelledByLabel ? (
            <Badge variant="secondary" role="status">
              {viewer.cancelledByLabel}
            </Badge>
          ) : null
        ) : variant === 'pending-mentor' ? (
          <div className="flex justify-end gap-2">
            <RejectReservationDialog
              reservation={reservation}
              disabled={isMutating}
              className="text-xs sm:text-sm"
              onReject={async ({ reason }) =>
                rejectOrCancel(reservation, reason, 'reject')
              }
            />
            <AcceptReservationDialog
              reservation={reservation}
              myUserId={myUserId}
              disabled={isMutating}
              className="text-xs sm:text-sm"
              onAccept={async ({ message }) => accept(reservation, message)}
            />
          </div>
        ) : (
          <CancelReservationDialog
            reservation={reservation}
            disabled={isMutating}
            className="w-full text-xs sm:w-auto sm:text-sm"
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
  onMutationSuccess?: (
    id: string,
    affected: MutationAffectedTabs | null
  ) => void;
  // Called once when a status update is rejected with a 409 version
  // conflict, so the parent hook can refetch the affected tabs in place.
  onVersionConflict?: (affected: MutationAffectedTabs | null) => void;
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
