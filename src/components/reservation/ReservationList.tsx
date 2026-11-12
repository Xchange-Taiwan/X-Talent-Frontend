'use client';

import { CalendarX2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import AcceptReservationDialog from '@/components/reservation/AcceptReservationDialog';
import CancelReservationDialog from '@/components/reservation/CancelReservationDialog';
import MeetingFeedbackDialog from '@/components/reservation/MeetingFeedbackDialog';
import RejectReservationDialog from '@/components/reservation/RejectReservationDialog';
import ReservationConversationDialog from '@/components/reservation/ReservationConversationDialog';
import { ReservationFeedbackBlock } from '@/components/reservation/ReservationFeedbackBlock';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useProfileLinkClick } from '@/hooks/reservation/useProfileLinkClick';
import { useReservationActions } from '@/hooks/user/reservation/useReservationActions';
import { trackEvent } from '@/lib/analytics';
import { resolveReservationViewer } from '@/lib/reservation/reservationViewerModel';
import { resolveHistoryFeedbackState } from '@/lib/reservation/resolveHistoryFeedbackState';
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

function resolveEmptyStateContent(
  sourceRole: SourceRole,
  variant: Variant,
  myUserId: string | undefined
): {
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
} {
  if (sourceRole === 'mentee') {
    const description =
      variant === 'upcoming'
        ? '目前還沒有即將到來的預約，立即前往導師池尋找適合的導師吧！'
        : variant === 'pending-mentee'
          ? '目前還沒有等待回覆的預約，前往導師池探索並向導師提出預約申請吧！'
          : '目前還沒有歷史預約紀錄，前往導師池展開你的第一場職涯交流吧！';
    return {
      description,
      ctaLabel: '前往尋找導師',
      ctaHref: '/mentor-pool',
    };
  }

  const description =
    variant === 'upcoming'
      ? '目前還沒有即將到來的預約，前往個人頁面確認或新增可預約時段，讓學員更容易找到你！'
      : variant === 'pending-mentor'
        ? '目前還沒有待您回覆的預約申請，前往個人頁面管理可預約時段以提升預約率！'
        : '目前還沒有歷史預約紀錄，前往個人頁面設定可預約時段，開始你的導師交流之旅吧！';
  return {
    description,
    ctaLabel: myUserId ? '管理可預約時段' : undefined,
    ctaHref: myUserId ? `/profile/${myUserId}` : undefined,
  };
}

/**
 * Individual Reservation List Item holding its own independent loading and action state.
 */
function ReservationItem({
  reservation,
  variant,
  sourceRole,
  myUserId,
  isTargetReservation = false,
  shouldAutoOpenFeedback = false,
}: {
  reservation: Reservation;
  variant: Variant;
  sourceRole: SourceRole;
  myUserId: string | undefined;
  isTargetReservation?: boolean;
  shouldAutoOpenFeedback?: boolean;
}) {
  const itemRef = React.useRef<HTMLDivElement>(null);
  const hasScrolledRef = React.useRef(false);

  React.useEffect(() => {
    if (!isTargetReservation || hasScrolledRef.current) return;
    hasScrolledRef.current = true;
    const el = itemRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isTargetReservation]);

  const { accept, rejectOrCancel, submitFeedback, updateFeedback, isMutating } =
    useReservationActions({
      myUserId,
      variant,
      myRole: sourceRole,
    });

  const viewer = resolveReservationViewer({
    reservation,
    myUserId,
  });

  const historyState =
    variant === 'history'
      ? resolveHistoryFeedbackState({
          reservation,
          sourceRole,
          cancelledByLabel: viewer.cancelledByLabel,
        })
      : null;

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
    <div ref={itemRef} data-reservation-id={reservation.id}>
      <ReservationCard
        item={reservation}
        myUserId={myUserId}
        variant={cardVariantOf(variant)}
        profileHref={viewer.profileHref}
        onProfileClick={handleProfileClick}
        disabled={isMutating}
        sourceRole={sourceRole}
        headerAction={
          historyState ? (
            historyState.headerAction.kind === 'answer-button' ? (
              <MeetingFeedbackDialog
                reservation={reservation}
                disabled={isMutating}
                defaultOpen={shouldAutoOpenFeedback}
                onSubmitFeedback={(payload) =>
                  submitFeedback(reservation, payload)
                }
              />
            ) : (
              <Badge variant="secondary" role="status">
                {historyState.headerAction.label}
              </Badge>
            )
          ) : null
        }
        feedbackContent={
          historyState?.feedbackBlock ? (
            <ReservationFeedbackBlock
              model={historyState.feedbackBlock}
              editAction={
                historyState.feedbackBlock.canEdit ? (
                  <MeetingFeedbackDialog
                    mode="edit"
                    reservation={reservation}
                    disabled={isMutating}
                    onUpdateFeedback={(payload) =>
                      updateFeedback(reservation, payload)
                    }
                  />
                ) : null
              }
            />
          ) : null
        }
        actions={
          variant === 'history' ? (
            historyState?.bottomStatusLabel ? (
              <Badge variant="secondary" role="status">
                {historyState.bottomStatusLabel}
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
          variant === 'history' &&
          (reservation.messages.length > 0 ||
            reservation.cancelledBy === 'SYSTEM') ? (
            <ReservationConversationDialog
              reservation={reservation}
              sourceRole={sourceRole}
            />
          ) : null
        }
      />
    </div>
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
  targetReservationId = null,
  autoOpenReservationId = null,
}: {
  items: Reservation[];
  variant: Variant;
  sourceRole: SourceRole;
  myUserId: string | undefined;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  targetReservationId?: string | null;
  autoOpenReservationId?: string | null;
}) {
  const emptyState = resolveEmptyStateContent(sourceRole, variant, myUserId);

  return (
    <div className="space-y-3 sm:space-y-4">
      {items.map((it) => (
        <ReservationItem
          key={it.id}
          reservation={it}
          variant={variant}
          sourceRole={sourceRole}
          myUserId={myUserId}
          isTargetReservation={
            variant === 'history' &&
            Boolean(targetReservationId && it.id === targetReservationId)
          }
          shouldAutoOpenFeedback={
            variant === 'history' &&
            Boolean(autoOpenReservationId && it.id === autoOpenReservationId)
          }
        />
      ))}

      {items.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <CalendarX2
              className="text-text-tertiary mb-1 size-10"
              aria-hidden="true"
            />
            <p className="text-text-primary text-base font-medium">
              目前尚無資料
            </p>
            <p className="text-text-secondary max-w-md text-sm">
              {emptyState.description}
            </p>
            {emptyState.ctaLabel && emptyState.ctaHref && (
              <Button asChild className="mt-2 rounded-full px-6">
                <Link href={emptyState.ctaHref}>{emptyState.ctaLabel}</Link>
              </Button>
            )}
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
