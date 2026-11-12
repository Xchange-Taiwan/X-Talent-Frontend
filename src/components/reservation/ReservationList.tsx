'use client';

import { CalendarX2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import AcceptReservationDialog from '@/components/reservation/AcceptReservationDialog';
import CancelReservationDialog from '@/components/reservation/CancelReservationDialog';
import MeetingFeedbackDialog from '@/components/reservation/MeetingFeedbackDialog';
import RejectReservationDialog from '@/components/reservation/RejectReservationDialog';
import ReservationConversationDialog from '@/components/reservation/ReservationConversationDialog';
import {
  ReservationFeedbackBlock,
  ReservationFeedbackHeaderToggle,
} from '@/components/reservation/ReservationFeedbackBlock';
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
 * Individual Reservation List Item holding its own independent loading, action, and collapsible feedback state.
 */
function ReservationItem({
  reservation,
  variant,
  sourceRole,
  myUserId,
  isHighlighted = false,
  shouldAutoExpandFeedback = false,
  deepLinkTriggerSeq = 0,
}: {
  reservation: Reservation;
  variant: Variant;
  sourceRole: SourceRole;
  myUserId: string | undefined;
  isHighlighted?: boolean;
  shouldAutoExpandFeedback?: boolean;
  deepLinkTriggerSeq?: number;
}) {
  const [isFeedbackExpanded, setIsFeedbackExpanded] = React.useState(
    () => shouldAutoExpandFeedback
  );
  const feedbackPanelId = React.useId();
  const cardWrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (shouldAutoExpandFeedback) {
      setIsFeedbackExpanded(true);
    }
  }, [shouldAutoExpandFeedback, deepLinkTriggerSeq]);

  React.useEffect(() => {
    if (isHighlighted && cardWrapperRef.current) {
      cardWrapperRef.current.scrollIntoView?.({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [isHighlighted, deepLinkTriggerSeq]);

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

  const renderHistoryHeaderAction = (): React.ReactNode => {
    if (!historyState) return null;

    if (historyState.headerAction.kind === 'answer-button') {
      return (
        <MeetingFeedbackDialog
          initialStep={
            reservation.feedback?.nextStep === 'RATE' ? 'rating' : 'attendance'
          }
          reservation={reservation}
          disabled={isMutating}
          onSubmitFeedback={(payload) => submitFeedback(reservation, payload)}
        />
      );
    }

    if (
      historyState.headerAction.kind === 'feedback-toggle' ||
      historyState.headerAction.kind === 'unpublicized-toggle'
    ) {
      return (
        <ReservationFeedbackHeaderToggle
          action={historyState.headerAction}
          isExpanded={isFeedbackExpanded}
          panelId={feedbackPanelId}
          onToggle={() => setIsFeedbackExpanded((prev) => !prev)}
        />
      );
    }

    return (
      <Badge
        variant="secondary"
        role="status"
        className="text-text-secondary rounded-md font-normal"
      >
        {historyState.headerAction.label}
      </Badge>
    );
  };

  return (
    <div
      ref={cardWrapperRef}
      id={`reservation-card-${reservation.id}`}
      data-reservation-id={reservation.id}
      data-highlighted={isHighlighted ? 'true' : undefined}
      className={
        isHighlighted
          ? 'ring-brand-500/60 rounded-xl ring-2 transition-shadow'
          : undefined
      }
    >
      <ReservationCard
        item={reservation}
        myUserId={myUserId}
        variant={cardVariantOf(variant)}
        profileHref={viewer.profileHref}
        onProfileClick={handleProfileClick}
        disabled={isMutating}
        sourceRole={sourceRole}
        headerAction={renderHistoryHeaderAction()}
        feedbackContent={
          historyState?.feedbackBlock && isFeedbackExpanded ? (
            <ReservationFeedbackBlock
              id={feedbackPanelId}
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

function MenteeDeepLinkFeedbackDialog({
  reservation,
  myUserId,
  onClose,
}: {
  reservation: Reservation;
  myUserId: string | undefined;
  onClose?: () => void;
}) {
  const { submitFeedback, isMutating } = useReservationActions({
    myUserId,
    variant: 'history',
    myRole: 'mentee',
  });

  return (
    <MeetingFeedbackDialog
      defaultOpen
      initialStep={
        reservation.feedback?.nextStep === 'RATE' ? 'rating' : 'attendance'
      }
      reservation={reservation}
      disabled={isMutating}
      trigger={<span className="sr-only">指定會談回饋視窗</span>}
      onSubmitFeedback={(payload, target) => submitFeedback(target, payload)}
      onClose={onClose}
    />
  );
}

function MenteePendingFeedbackQueueDialog({
  queueItems,
  myUserId,
  onClose,
}: {
  queueItems: Reservation[];
  myUserId: string | undefined;
  onClose?: () => void;
}) {
  const { submitFeedback, isMutating } = useReservationActions({
    myUserId,
    variant: 'history',
    myRole: 'mentee',
  });

  return (
    <MeetingFeedbackDialog
      defaultOpen
      reservation={queueItems[0]}
      queue={queueItems}
      disabled={isMutating}
      trigger={<span className="sr-only">待填會談回饋佇列</span>}
      onSubmitFeedback={(payload, target) => submitFeedback(target, payload)}
      onClose={onClose}
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
  feedbackQueueItems = null,
  onFeedbackQueueClose,
  deepLinkDialogReservation = null,
  onDeepLinkDialogClose,
  highlightedReservationId = null,
  autoExpandedReservationId = null,
  deepLinkTriggerSeq = 0,
}: {
  items: Reservation[];
  variant: Variant;
  sourceRole: SourceRole;
  myUserId: string | undefined;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  feedbackQueueItems?: Reservation[] | null;
  onFeedbackQueueClose?: () => void;
  deepLinkDialogReservation?: Reservation | null;
  onDeepLinkDialogClose?: () => void;
  highlightedReservationId?: string | null;
  autoExpandedReservationId?: string | null;
  deepLinkTriggerSeq?: number;
}) {
  const emptyState = resolveEmptyStateContent(sourceRole, variant, myUserId);

  return (
    <div className="space-y-3 sm:space-y-4">
      {deepLinkDialogReservation &&
      variant === 'history' &&
      sourceRole === 'mentee' ? (
        <MenteeDeepLinkFeedbackDialog
          key={deepLinkDialogReservation.id}
          reservation={deepLinkDialogReservation}
          myUserId={myUserId}
          onClose={onDeepLinkDialogClose}
        />
      ) : feedbackQueueItems &&
        feedbackQueueItems.length > 0 &&
        variant === 'history' &&
        sourceRole === 'mentee' ? (
        <MenteePendingFeedbackQueueDialog
          queueItems={feedbackQueueItems}
          myUserId={myUserId}
          onClose={onFeedbackQueueClose}
        />
      ) : null}

      {items.map((it) => (
        <ReservationItem
          key={it.id}
          reservation={it}
          variant={variant}
          sourceRole={sourceRole}
          myUserId={myUserId}
          isHighlighted={
            variant === 'history' && highlightedReservationId === it.id
          }
          shouldAutoExpandFeedback={
            variant === 'history' && autoExpandedReservationId === it.id
          }
          deepLinkTriggerSeq={variant === 'history' ? deepLinkTriggerSeq : 0}
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
