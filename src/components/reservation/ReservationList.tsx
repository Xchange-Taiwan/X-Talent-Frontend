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

import {
  ReservationCard,
  type ReservationCardVariant,
} from './ReservationCard';
import type { Reservation } from './types';

type Variant = 'upcoming' | 'pending-mentee' | 'pending-mentor' | 'history';
type SourceRole = 'mentor' | 'mentee';

const cardVariantOf = (variant: Variant): ReservationCardVariant =>
  variant === 'upcoming'
    ? 'upcoming'
    : variant === 'history'
      ? 'history'
      : 'pending';

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
  myUserId: string | undefined;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  // Called after a successful accept / reject / cancel so the parent hook can
  // optimistically remove the operated item and refetch only the affected
  // states in the background.
  onMutationSuccess?: (id: string, affectedTabs: ListKey[]) => void;
}) {
  const { accept, rejectOrCancel, buildProfileHref, isMutating } =
    useReservationActions({
      items,
      myUserId,
      variant,
      onMutationSuccess,
    });

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
          variant={cardVariantOf(variant)}
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
                  disabled={isMutating}
                  onReject={async ({ id, reason }) =>
                    rejectOrCancel(id, reason, '已拒絕預約')
                  }
                />
                <AcceptReservationDialog
                  reservation={it}
                  disabled={isMutating}
                  onAccept={accept}
                />
              </div>
            ) : (
              <CancelReservationDialog
                reservation={it}
                disabled={isMutating}
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
