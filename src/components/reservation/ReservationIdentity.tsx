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

const DEFAULT_AVATAR_CLASSNAME = 'size-10 sm:size-12';
const DEFAULT_HEADER_CONTAINER_CLASSNAME =
  'flex w-full min-w-0 items-center gap-3';
const DEFAULT_NAME_ROW_CLASSNAME =
  'flex w-full min-w-0 flex-wrap items-center justify-between gap-2';
const DEFAULT_NAME_CLASSNAME =
  'block truncate font-medium hover:underline sm:text-base';
const DEFAULT_ROLE_LINE_CLASSNAME =
  'truncate text-xs text-text-tertiary sm:text-sm';
const DEFAULT_BADGE_CLASSNAME = 'shrink-0 px-1.5 text-11 font-normal';
const DEFAULT_DATE_TIME_CLASSNAME =
  'mt-4 grid grid-cols-1 gap-2 text-xs text-text-tertiary sm:grid-cols-2 sm:text-sm';

export interface ReservationIdentityHeaderProps {
  reservation: Reservation;
  /** Profile URL for the counterparty. When absent, the avatar and name render as plain (non-link) elements. */
  profileHref?: string;
  onProfileLinkClick?: (e: React.MouseEvent) => void;
  /** Whether the avatar and name should link to the profile at all. Defaults to true. */
  linkToProfile?: boolean;
  /** Whether to render the reservation status badge next to the name. Defaults to false. */
  showStatusBadge?: boolean;
  /** Makes the profile link inert (e.g. while a mutation is in flight). */
  disabled?: boolean;
  avatarClassName?: string;
  avatarFallbackClassName?: string;
  containerClassName?: string;
  nameRowClassName?: string;
  nameClassName?: string;
  roleLineClassName?: string;
  badgeClassName?: string;
  /** Wraps the badge in an extra element (e.g. for a dedicated shrink-0 slot). Badge renders unwrapped when omitted. */
  badgeWrapperClassName?: string;
  /** Extra content rendered in the same content column, below the role line (e.g. ReservationCard's date/time row and actions). */
  children?: React.ReactNode;
}

/**
 * Avatar + name + role line (+ optional status badge) block shared by every
 * reservation surface. Split out from ReservationIdentity so surfaces whose
 * date/time and message layout diverges too far to share (e.g. ReservationCard)
 * can still render an identical identity block via className overrides.
 */
export function ReservationIdentityHeader({
  reservation,
  profileHref,
  onProfileLinkClick,
  linkToProfile = true,
  showStatusBadge = false,
  disabled = false,
  avatarClassName = DEFAULT_AVATAR_CLASSNAME,
  avatarFallbackClassName,
  containerClassName = DEFAULT_HEADER_CONTAINER_CLASSNAME,
  nameRowClassName = DEFAULT_NAME_ROW_CLASSNAME,
  nameClassName = DEFAULT_NAME_CLASSNAME,
  roleLineClassName = DEFAULT_ROLE_LINE_CLASSNAME,
  badgeClassName = DEFAULT_BADGE_CLASSNAME,
  badgeWrapperClassName,
  children,
}: ReservationIdentityHeaderProps) {
  const initials = getInitials(reservation.name);
  const href = linkToProfile ? profileHref : undefined;

  const badge = showStatusBadge ? (
    <ReservationStatusBadge
      dtstart={reservation.dtstart}
      dtend={reservation.dtend}
      className={badgeClassName}
    />
  ) : null;

  return (
    <div className={containerClassName}>
      <ProfileLinkWrapper
        href={href}
        onClick={onProfileLinkClick}
        disabled={disabled}
        className="shrink-0 rounded-full transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none"
        ariaLabel={`查看 ${reservation.name} 的個人資料`}
      >
        <Avatar className={avatarClassName}>
          <AvatarImage
            src={
              reservation.avatar
                ? getAvatarThumbUrl(reservation.avatar)
                : undefined
            }
            alt={reservation.name}
          />
          <AvatarFallback className={avatarFallbackClassName}>
            {initials}
          </AvatarFallback>
        </Avatar>
      </ProfileLinkWrapper>
      <div className="min-w-0 flex-1">
        <div className={nameRowClassName}>
          <ProfileLinkWrapper
            href={href}
            onClick={onProfileLinkClick}
            disabled={disabled}
            className="group block min-w-0 flex-1 truncate rounded-sm no-underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <span className={nameClassName}>{reservation.name}</span>
          </ProfileLinkWrapper>
          {badge && badgeWrapperClassName ? (
            <div className={badgeWrapperClassName}>{badge}</div>
          ) : (
            badge
          )}
        </div>
        <div className={roleLineClassName}>{reservation.roleLine}</div>
        {children}
      </div>
    </div>
  );
}

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
  /** Whether to render the mentee/mentor message blocks below the card. Defaults to true. */
  showMessages?: boolean;
  avatarClassName?: string;
  nameClassName?: string;
  roleLineClassName?: string;
  dateTimeClassName?: string;
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
  showMessages = true,
  avatarClassName,
  nameClassName,
  roleLineClassName,
  dateTimeClassName = DEFAULT_DATE_TIME_CLASSNAME,
  className,
}: ReservationIdentityProps) {
  const menteeMessage = reservation.menteeMessage?.content;
  const mentorMessage = reservation.mentorMessage?.content;

  return (
    <>
      <div
        className={cn(
          'rounded-2xl border',
          containerPaddingByDensity[density],
          className
        )}
      >
        <ReservationIdentityHeader
          reservation={reservation}
          profileHref={profileHref}
          onProfileLinkClick={onProfileLinkClick}
          linkToProfile={linkToProfile}
          showStatusBadge={showStatusBadge}
          disabled={disabled}
          avatarClassName={avatarClassName}
          nameClassName={nameClassName}
          roleLineClassName={roleLineClassName}
        />

        <div className={dateTimeClassName}>
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

      {showMessages && menteeMessage ? (
        <MessageBlock label="學員留言" content={menteeMessage} />
      ) : null}
      {showMessages && mentorMessage ? (
        <MessageBlock label="導師回覆" content={mentorMessage} />
      ) : null}
    </>
  );
}

function MessageBlock({ label, content }: { label: string; content: string }) {
  return (
    <div className="mt-6">
      <div className="mb-2 text-sm font-medium text-text-primary">{label}</div>
      <div className="flex items-start gap-2 rounded-2xl border bg-background-bottom/40 p-4 text-xs sm:text-sm">
        <MessageSquare
          className="mt-0.5 size-4 shrink-0 text-text-tertiary"
          aria-hidden
        />
        <p className="break-words whitespace-pre-wrap text-text-primary">
          {content}
        </p>
      </div>
    </div>
  );
}
