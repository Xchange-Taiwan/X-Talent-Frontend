'use client';

import { CalendarDays, Clock } from 'lucide-react';
import * as React from 'react';

import { ReservationMessagePreview } from '@/components/reservation/ReservationMessagePreview';
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

/**
 * `dialog` - ConfirmedReservationDialog / QuickReplyDialog's identity block.
 * `compact` - AcceptReservationDialog's smaller, non-responsive avatar and plainer text.
 * `card` - ReservationCard's top-aligned layout with a wrapped, shrink-0 badge slot.
 */
export type ReservationIdentityHeaderVariant = 'dialog' | 'compact' | 'card';

interface HeaderVariantStyle {
  avatarClassName: string;
  avatarFallbackClassName?: string;
  containerClassName: string;
  nameRowClassName: string;
  /** className for the ProfileLinkWrapper around the name (and, when roleLineInsideLink, the role line too). */
  nameLinkClassName: string;
  roleLineClassName: string;
  /**
   * Whether the role line renders inside the name's link, sharing its
   * width constraint with the badge (card - matches ReservationCard's
   * original nesting so a badge still squeezes a long role line the same
   * way), or as a separate full-width row below (dialog/compact).
   */
  roleLineInsideLink: boolean;
  badgeClassName: string;
  badgeWrapperClassName?: string;
  nameClassName: (isLink: boolean) => string;
}

const DIALOG_NAME_LINK_CLASSNAME =
  'group block min-w-0 flex-1 truncate rounded-sm no-underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none';

const headerVariantStyles: Record<
  ReservationIdentityHeaderVariant,
  HeaderVariantStyle
> = {
  dialog: {
    avatarClassName: 'size-10 sm:size-12',
    containerClassName: 'flex w-full min-w-0 items-center gap-3',
    nameRowClassName:
      'flex w-full min-w-0 flex-wrap items-center justify-between gap-2',
    nameLinkClassName: DIALOG_NAME_LINK_CLASSNAME,
    roleLineClassName: 'truncate text-xs text-text-tertiary sm:text-sm',
    roleLineInsideLink: false,
    badgeClassName: 'shrink-0 px-1.5 text-11 font-normal',
    nameClassName: () => 'truncate font-medium hover:underline sm:text-base',
  },
  compact: {
    avatarClassName: 'size-10',
    containerClassName: 'flex w-full min-w-0 items-center gap-3',
    nameRowClassName:
      'flex w-full min-w-0 flex-wrap items-center justify-between gap-2',
    nameLinkClassName: DIALOG_NAME_LINK_CLASSNAME,
    roleLineClassName: 'truncate text-sm text-text-tertiary',
    roleLineInsideLink: false,
    badgeClassName: 'shrink-0 px-1.5 text-11 font-normal',
    nameClassName: () => 'truncate font-medium',
  },
  card: {
    avatarClassName: 'size-10 sm:size-12',
    avatarFallbackClassName: 'font-medium',
    containerClassName: 'flex items-start gap-3 sm:gap-4',
    nameRowClassName: 'flex min-w-0 items-start justify-between gap-2',
    nameLinkClassName:
      'group min-w-0 truncate rounded-sm no-underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none',
    roleLineClassName: 'truncate text-xs text-text-tertiary sm:text-sm',
    roleLineInsideLink: true,
    badgeClassName: 'px-1.5 text-11',
    badgeWrapperClassName: 'flex shrink-0 items-center gap-2',
    nameClassName: (isLink) =>
      cn(
        'truncate text-sm font-medium sm:text-base',
        isLink && 'group-hover:underline'
      ),
  },
};

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
  /** Which surface's layout/styling to render. Defaults to 'dialog'. */
  variant?: ReservationIdentityHeaderVariant;
  /** Extra content rendered in the same content column, below the role line (e.g. ReservationCard's date/time row and actions). */
  children?: React.ReactNode;
}

/**
 * Avatar + name + role line (+ optional status badge) block shared by every
 * reservation surface. Split out from ReservationIdentity so surfaces whose
 * date/time and message layout diverges too far to share (e.g. ReservationCard)
 * can still render an identical identity block.
 */
export function ReservationIdentityHeader({
  reservation,
  profileHref,
  onProfileLinkClick,
  linkToProfile = true,
  showStatusBadge = false,
  disabled = false,
  variant = 'dialog',
  children,
}: ReservationIdentityHeaderProps) {
  const initials = getInitials(reservation.name);
  const href = linkToProfile ? profileHref : undefined;
  const style = headerVariantStyles[variant];

  const badge = showStatusBadge ? (
    <ReservationStatusBadge
      dtstart={reservation.dtstart}
      dtend={reservation.dtend}
      className={style.badgeClassName}
    />
  ) : null;

  return (
    <div className={style.containerClassName}>
      <ProfileLinkWrapper
        href={href}
        onClick={onProfileLinkClick}
        disabled={disabled}
        className="shrink-0 rounded-full transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none"
        ariaLabel={`查看 ${reservation.name} 的個人資料`}
      >
        <Avatar className={style.avatarClassName}>
          <AvatarImage
            src={
              reservation.avatar
                ? getAvatarThumbUrl(reservation.avatar)
                : undefined
            }
            alt={reservation.name}
          />
          <AvatarFallback className={style.avatarFallbackClassName}>
            {initials}
          </AvatarFallback>
        </Avatar>
      </ProfileLinkWrapper>
      <div className="min-w-0 flex-1">
        <div className={style.nameRowClassName}>
          <ProfileLinkWrapper
            href={href}
            onClick={onProfileLinkClick}
            disabled={disabled}
            className={style.nameLinkClassName}
          >
            <div className={style.nameClassName(Boolean(href))}>
              {reservation.name}
            </div>
            {style.roleLineInsideLink ? (
              <div className={style.roleLineClassName}>
                {reservation.roleLine}
              </div>
            ) : null}
          </ProfileLinkWrapper>
          {badge && style.badgeWrapperClassName ? (
            <div className={style.badgeWrapperClassName}>{badge}</div>
          ) : (
            badge
          )}
        </div>
        {!style.roleLineInsideLink ? (
          <div className={style.roleLineClassName}>{reservation.roleLine}</div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

/**
 * `dialog` - shared by ConfirmedReservationDialog / QuickReplyDialog.
 * `accept` - AcceptReservationDialog's smaller avatar, plainer date/time row,
 * and no auto-rendered message blocks (it renders its own, differently labeled).
 */
export type ReservationIdentityVariant = 'dialog' | 'accept';

const headerVariantByIdentityVariant: Record<
  ReservationIdentityVariant,
  ReservationIdentityHeaderVariant
> = {
  dialog: 'dialog',
  accept: 'compact',
};

const dateTimeClassNameByVariant: Record<ReservationIdentityVariant, string> = {
  dialog:
    'mt-4 grid grid-cols-1 gap-2 text-xs text-text-tertiary sm:grid-cols-2 sm:text-sm',
  accept: 'mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2',
};

const defaultShowMessagesByVariant: Record<
  ReservationIdentityVariant,
  boolean
> = {
  dialog: true,
  accept: false,
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
  /** Which surface's layout/styling to render. Defaults to 'dialog'. */
  variant?: ReservationIdentityVariant;
  /** Whether to render the mentee/mentor message blocks below the card. Defaults to true for 'dialog', false for 'accept'. */
  showMessages?: boolean;
  /**
   * Which role the current user is browsing as, for the message preview's
   * "view full conversation" analytics. Defaults to 'mentor' since every
   * current 'dialog'-variant caller (ConfirmedReservationDialog,
   * QuickReplyDialog) only ever renders on a mentor's own calendar.
   */
  sourceRole?: 'mentor' | 'mentee';
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
  variant = 'dialog',
  showMessages,
  sourceRole = 'mentor',
  className,
}: ReservationIdentityProps) {
  const resolvedShowMessages =
    showMessages ?? defaultShowMessagesByVariant[variant];

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
          variant={headerVariantByIdentityVariant[variant]}
        />

        <div className={dateTimeClassNameByVariant[variant]}>
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

      {resolvedShowMessages ? (
        <ReservationMessagePreview
          reservation={reservation}
          sourceRole={sourceRole}
          variant="dialog"
        />
      ) : null}
    </>
  );
}
