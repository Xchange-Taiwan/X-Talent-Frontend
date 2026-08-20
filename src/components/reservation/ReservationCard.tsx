import { CalendarDays, Clock, Mail, MessageSquare } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import * as React from 'react';

import { ReservationStatusBadge } from '@/components/reservation/ReservationStatusBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
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
            <div className="flex flex-wrap items-center justify-between gap-2">
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
              <div className="shrink-0">{actions}</div>
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
              {isUpcoming ? (
                <ReservationStatusBadge
                  dtstart={item.dtstart}
                  dtend={item.dtend}
                />
              ) : null}
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
              <div className="mt-3 flex items-center gap-1.5 text-11 text-text-tertiary sm:text-xs">
                <Mail className="size-3.5 shrink-0" aria-hidden />
                <span>會議連結已寄至您的信箱</span>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
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
