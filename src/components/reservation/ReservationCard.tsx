import { CalendarDays, Clock, Mail, MessageSquare } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import * as React from 'react';

import { ReservationStatusBadge } from '@/components/reservation/ReservationStatusBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useReservationMeetLink } from '@/hooks/user/reservation/useReservationMeetLink';
import { getAvatarThumbUrl } from '@/lib/avatar/getAvatarThumbUrl';
import type { Reservation } from '@/types/reservation';

export type ReservationCardVariant = 'upcoming' | 'pending' | 'history';

export function ReservationCard({
  item,
  actions,
  footer,
  profileHref,
  onProfileClick,
  variant,
  myUserId,
}: {
  item: Reservation;
  actions?: React.ReactNode;
  // Optional slot rendered below the message preview. Used by HISTORY tabs to
  // mount the "view full conversation" entry without coupling the card to it.
  footer?: React.ReactNode;
  profileHref?: string;
  onProfileClick?: () => void;
  // Drives upcoming-only affordances (status badge and email hint).
  variant?: ReservationCardVariant;
  myUserId?: string | number;
}) {
  const isUpcoming = variant === 'upcoming';
  const { menteeMessage, mentorMessage } = item;
  const hasAnyMessage = Boolean(menteeMessage || mentorMessage);

  const initials = item.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');

  const [imageFailed, setImageFailed] = React.useState(false);

  const avatar = (
    <Avatar className="size-10 sm:size-12">
      {item.avatar && !imageFailed ? (
        <Image
          src={getAvatarThumbUrl(item.avatar)}
          alt={item.name}
          fill
          sizes="(min-width: 640px) 48px, 40px"
          className="object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <AvatarFallback className="font-medium">{initials}</AvatarFallback>
    </Avatar>
  );

  const profileAriaLabel = `查看 ${item.name} 的個人資料`;

  return (
    <Card
      className="border-background-border/40 transition-shadow hover:shadow-sm"
      data-testid="reservation-card"
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Avatar */}
          {profileHref ? (
            <Link
              href={profileHref}
              aria-label={profileAriaLabel}
              onClick={onProfileClick}
              className="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {avatar}
            </Link>
          ) : (
            <div className="shrink-0">{avatar}</div>
          )}

          {/* Main content */}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              {profileHref ? (
                <Link
                  href={profileHref}
                  aria-label={profileAriaLabel}
                  onClick={onProfileClick}
                  className="group min-w-0 truncate rounded-sm no-underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <div className="truncate text-sm font-medium group-hover:underline sm:text-base">
                    {item.name}
                  </div>
                  <div className="truncate text-xs text-text-tertiary sm:text-sm">
                    {item.roleLine}
                  </div>
                </Link>
              ) : (
                <div className="min-w-0 truncate">
                  <div className="truncate text-sm font-medium sm:text-base">
                    {item.name}
                  </div>
                  <div className="truncate text-xs text-text-tertiary sm:text-sm">
                    {item.roleLine}
                  </div>
                </div>
              )}
              {/* Show status badge in top-right ALWAYS on all screen sizes */}
              <div className="flex shrink-0 items-center gap-2">
                {isUpcoming && (
                  <ReservationStatusBadge
                    dtstart={item.dtstart}
                    dtend={item.dtend}
                  />
                )}
              </div>
            </div>

            {/* Divider only on >=sm to match Figma feel */}
            <div className="my-3 hidden h-px bg-background-border sm:block" />

            {/* Date & time row */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-text-tertiary sm:mt-0 sm:text-sm">
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

            {hasAnyMessage ? (
              <div className="mt-3 space-y-2">
                {menteeMessage ? (
                  <MessageBlock
                    label="學員留言"
                    content={menteeMessage.content}
                  />
                ) : null}
                {mentorMessage ? (
                  <MessageBlock
                    label="導師回覆"
                    content={mentorMessage.content}
                  />
                ) : null}
              </div>
            ) : null}

            {footer ? <div className="mt-3">{footer}</div> : null}

            {isUpcoming ? (
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-1.5 text-11 text-text-tertiary sm:text-xs">
                  <Mail className="size-3.5 shrink-0" aria-hidden />
                  <span>會議連結已寄至您的信箱</span>
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  {/* Actions (such as cancel button) grouped with Meet button on all screen sizes */}
                  <div className="flex-1 sm:flex-none">{actions}</div>
                  <div className="flex-1 sm:flex-none">
                    <JoinMeetButton
                      reservationId={item.id}
                      myUserId={myUserId}
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function JoinMeetButton({
  reservationId,
  myUserId,
}: {
  reservationId: string;
  myUserId?: string | number;
}) {
  const { joinMeet, isPending } = useReservationMeetLink({ myUserId });

  return (
    <Button
      onClick={() => joinMeet(reservationId)}
      disabled={isPending}
      size="sm"
      className="h-9 w-full rounded-lg bg-brand-500 px-4 text-xs font-medium text-text-primary hover:bg-brand-500/90 sm:w-auto sm:text-sm"
    >
      {isPending ? (
        '載入中...'
      ) : (
        <>
          <span className="hidden sm:inline">加入 Google Meet</span>
          <span className="sm:hidden">加入會議</span>
        </>
      )}
    </Button>
  );
}

function MessageBlock({ label, content }: { label: string; content: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-background-bottom/40 p-2.5 text-xs sm:text-sm">
      <MessageSquare
        className="mt-0.5 size-3.5 shrink-0 text-text-tertiary sm:size-4"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="text-11 font-medium text-text-tertiary sm:text-xs">
          {label}
        </div>
        <p className="mt-0.5 line-clamp-2 break-words whitespace-pre-wrap text-text-primary">
          {content}
        </p>
      </div>
    </div>
  );
}
