import { AlertCircle, CalendarDays, Clock } from 'lucide-react';
import * as React from 'react';

import { JoinMeetButton } from '@/components/reservation/JoinMeetButton';
import { ReservationIdentityHeader } from '@/components/reservation/ReservationIdentity';
import { ReservationMessagePreview } from '@/components/reservation/ReservationMessagePreview';
import { Card, CardContent } from '@/components/ui/card';
import { useReservationMeetLink } from '@/hooks/user/reservation/useReservationMeetLink';
import type { Reservation } from '@/types/reservation';

export type ReservationCardVariant = 'upcoming' | 'pending' | 'history';

export function ReservationCard({
  item,
  headerAction,
  feedbackContent,
  actions,
  footer,
  profileHref,
  onProfileClick,
  disabled,
  variant,
  myUserId,
  sourceRole,
}: {
  item: Reservation;
  // Optional slot rendered in the top-right header next to the name (e.g. History 填寫回饋 button or status badge).
  headerAction?: React.ReactNode;
  // Optional slot rendered below the message preview for post-meeting rating/unpublicized feedback display.
  feedbackContent?: React.ReactNode;
  actions?: React.ReactNode;
  // Optional slot rendered below the message preview. Used by HISTORY tabs to
  // mount the "view full conversation" entry without coupling the card to it.
  footer?: React.ReactNode;
  profileHref?: string;
  onProfileClick?: (e: React.MouseEvent) => void;
  // Makes the profile link inert (e.g. while a mutation is in flight).
  disabled?: boolean;
  // Drives upcoming-only affordances (status badge and email hint).
  variant?: ReservationCardVariant;
  myUserId?: string | number;
  // Which role the current user is browsing as. Required (no default) so a
  // caller can't silently misattribute the message preview's "view full
  // conversation" analytics - ReservationList always passes this explicitly
  // for both its mentor and mentee surfaces.
  sourceRole: 'mentor' | 'mentee';
}) {
  const isUpcoming = variant === 'upcoming';
  const isHistory = variant === 'history';

  return (
    <Card
      className="border-background-border/40 transition-shadow hover:shadow-sm"
      data-testid="reservation-card"
    >
      <CardContent className="p-3 sm:p-4">
        <ReservationIdentityHeader
          reservation={item}
          profileHref={profileHref}
          onProfileLinkClick={onProfileClick}
          disabled={disabled}
          showStatusBadge={isUpcoming}
          headerAction={headerAction}
          variant="card"
        >
          {/* Divider only on >=sm to match Figma feel */}
          <div className="bg-background-border my-3 hidden h-px sm:block" />

          {/* Date & time row */}
          <div className="text-text-tertiary mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs sm:mt-0 sm:text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="size-4" aria-hidden />
                <span className="truncate">{item.date}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden />
                <span className="truncate">{item.time}</span>
              </div>
            </div>
          </div>

          <ReservationMessagePreview
            reservation={item}
            sourceRole={sourceRole}
            variant="card"
          />

          {item.cancelledBy === 'SYSTEM' ? (
            <div
              role="note"
              className="border-status-warning-default/40 bg-status-warning-active/15 text-text-primary mt-3 flex items-start gap-2 rounded-lg border p-2.5 text-xs sm:text-sm"
            >
              <AlertCircle
                className="text-status-info-default mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              <span>
                {sourceRole === 'mentor'
                  ? '因您未於預約開始前 24 小時前確認，系統已自動取消此預約。'
                  : '因導師未於預約開始前 24 小時前確認，系統已自動取消此預約。'}
              </span>
            </div>
          ) : null}

          {feedbackContent}

          {isHistory ? (
            footer || actions ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div>{footer}</div>
                {actions ? (
                  <div className="ml-auto flex items-center gap-2">
                    {actions}
                  </div>
                ) : null}
              </div>
            ) : null
          ) : (
            <>
              {footer ? <div className="mt-3">{footer}</div> : null}

              {isUpcoming ? (
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    {/* Actions (such as cancel button) grouped with Meet button on all screen sizes */}
                    {actions ? (
                      <div className="flex-1 sm:flex-none">{actions}</div>
                    ) : null}
                    <div className="flex-1 sm:flex-none">
                      <UpcomingJoinMeetButton
                        reservationId={item.id}
                        myUserId={myUserId}
                        sourceRole={sourceRole}
                      />
                    </div>
                  </div>
                </div>
              ) : /* If not upcoming (e.g. pending), show actions at the bottom on all screen sizes */
              actions ? (
                <div className="mt-3 flex w-full items-center justify-end gap-2">
                  {actions}
                </div>
              ) : null}
            </>
          )}
        </ReservationIdentityHeader>
      </CardContent>
    </Card>
  );
}

function UpcomingJoinMeetButton({
  reservationId,
  myUserId,
  sourceRole,
}: {
  reservationId: string;
  myUserId?: string | number;
  sourceRole: 'mentor' | 'mentee';
}) {
  const { joinMeet, isPending } = useReservationMeetLink({ myUserId });

  return (
    <JoinMeetButton
      onClick={() => joinMeet(reservationId)}
      isPending={isPending}
      size="sm"
      sourceRole={sourceRole}
      analyticsLocation="reservation_card"
      className="h-9 w-full rounded-lg px-4 text-xs font-medium sm:w-auto sm:text-sm"
    />
  );
}
