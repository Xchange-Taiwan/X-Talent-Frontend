'use client';

import AcceptReservationDialog from '@/components/reservation/AcceptReservationDialog';
import CancelReservationDialog from '@/components/reservation/CancelReservationDialog';
import RejectReservationDialog from '@/components/reservation/RejectReservationDialog';
import ReservationConversationDialog from '@/components/reservation/ReservationConversationDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { ListKey } from '@/hooks/user/reservation/useReservationData';
import { trackEvent } from '@/lib/analytics';
import {
  ACCEPT_AFFECTED_TABS,
  acceptReservation,
  rejectOrCancelReservation,
  resolveOtherId,
} from '@/services/reservations';

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
  myUserId: string;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  // Called after a successful accept / reject / cancel so the parent hook can
  // optimistically remove the operated item and refetch only the affected
  // states in the background.
  onMutationSuccess?: (id: string, affectedTabs: ListKey[]) => void;
}) {
  const { toast } = useToast();

  const findItem = (id: string): Reservation => {
    const found = items.find((x) => x.id === id);
    if (!found)
      throw new Error(`[ReservationList] item not found for id=${id}`);
    return found;
  };

  // Accept a booking request (mentor side, pending-mentor variant)
  const accept = async ({ id, message }: { id: string; message: string }) => {
    const it = findItem(id);
    await acceptReservation({
      id,
      message,
      reservation: it,
      myUserId,
    });
    toast({
      title: '已接受預約',
      description: '會議連結將於數分鐘內寄至雙方信箱',
    });
    onMutationSuccess?.(id, ACCEPT_AFFECTED_TABS);
  };

  // Shared handler for both reject and cancel (same API call)
  const rejectOrCancel = async (
    id: string,
    text: string,
    successMessage: string
  ) => {
    const it = findItem(id);
    const { affectedTabs } = await rejectOrCancelReservation({
      id,
      text,
      reservation: it,
      myUserId,
      variant,
    });
    toast({ description: successMessage });
    onMutationSuccess?.(id, affectedTabs);
  };

  // Build a profile link to the *other* party. Skip when we don't have
  // a logged-in user (link would be ambiguous) or when the other id would
  // resolve to the current user (defensive — shouldn't happen in practice).
  const buildProfileHref = (it: Reservation): string | undefined => {
    if (!myUserId) return undefined;
    const otherId = resolveOtherId(it, myUserId);
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
