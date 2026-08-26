'use client';

import { CalendarDays, Clock, MessageSquare } from 'lucide-react';
import * as React from 'react';

import { ReservationStatusBadge } from '@/components/reservation/ReservationStatusBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarThumbUrl } from '@/lib/avatar/getAvatarThumbUrl';
import { getInitials } from '@/lib/avatar/getInitials';
import { cn } from '@/lib/utils';
import type { Reservation } from '@/types/reservation';

import { ProfileLinkWrapper } from './ProfileLinkWrapper';

export type ReservationIdentityDensity = 'default' | 'compact';

const containerPaddingByDensity: Record<ReservationIdentityDensity, string> = {
  default: 'p-4 sm:p-5',
  compact: 'p-3.5 sm:p-5',
};

export interface ReservationIdentityProps {
  reservation: Reservation;
  /** Profile URL for the counterparty. When absent, the avatar and name render as plain (non-link) elements. */
  profileHref?: string;
  onProfileLinkClick?: (e: React.MouseEvent) => void;
  /** Whether the avatar and name should link to the profile at all. Defaults to true. */
  linkToProfile?: boolean;
  /** Whether to render the reservation status badge next to the name. Defaults to false. */
  showStatusBadge?: boolean;
  /** Controls the identity card's padding. Defaults to 'default'. */
  density?: ReservationIdentityDensity;
  /** Makes the profile link inert (e.g. while a mutation is in flight). */
  disabled?: boolean;
  className?: string;
}

export function ReservationIdentity({
  reservation,
  profileHref,
  onProfileLinkClick,
  linkToProfile = true,
  showStatusBadge = false,
  density = 'default',
  disabled = false,
  className,
}: ReservationIdentityProps) {
  const initials = getInitials(reservation.name);
  const href = linkToProfile ? profileHref : undefined;
  const menteeMessage = reservation.menteeMessage?.content;

  return (
    <>
      <div
        className={cn(
          'rounded-2xl border',
          containerPaddingByDensity[density],
          className
        )}
      >
        <div className="flex w-full min-w-0 items-center gap-3">
          <ProfileLinkWrapper
            href={href}
            onClick={onProfileLinkClick}
            disabled={disabled}
            className="shrink-0 rounded-full transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none"
            ariaLabel={`查看 ${reservation.name} 的個人資料`}
          >
            <Avatar className="size-10 sm:size-12">
              <AvatarImage
                src={
                  reservation.avatar
                    ? getAvatarThumbUrl(reservation.avatar)
                    : undefined
                }
                alt={reservation.name}
              />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </ProfileLinkWrapper>
          <div className="min-w-0 flex-1">
            <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
              <ProfileLinkWrapper
                href={href}
                onClick={onProfileLinkClick}
                disabled={disabled}
                className="group block min-w-0 flex-1 truncate rounded-sm no-underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span className="block truncate font-medium hover:underline sm:text-base">
                  {reservation.name}
                </span>
              </ProfileLinkWrapper>
              {showStatusBadge ? (
                <ReservationStatusBadge
                  dtstart={reservation.dtstart}
                  dtend={reservation.dtend}
                  className="shrink-0 px-1.5 text-11 font-normal"
                />
              ) : null}
            </div>
            <div className="truncate text-xs text-text-tertiary sm:text-sm">
              {reservation.roleLine}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-text-tertiary sm:grid-cols-2 sm:text-sm">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{reservation.date}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{reservation.time}</span>
          </div>
        </div>
      </div>

      {menteeMessage ? (
        <div className="mt-6">
          <div className="mb-2 text-sm font-medium text-text-primary">
            學員留言
          </div>
          <div className="flex items-start gap-2 rounded-2xl border bg-background-bottom/40 p-4 text-xs sm:text-sm">
            <MessageSquare
              className="mt-0.5 size-4 shrink-0 text-text-tertiary"
              aria-hidden
            />
            <p className="break-words whitespace-pre-wrap text-text-primary">
              {menteeMessage}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
