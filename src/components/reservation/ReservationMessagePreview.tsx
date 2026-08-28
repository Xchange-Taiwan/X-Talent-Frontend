'use client';

import { MessageSquare } from 'lucide-react';
import * as React from 'react';

import ReservationConversationDialog from '@/components/reservation/ReservationConversationDialog';
import type { Reservation } from '@/types/reservation';

export type ReservationMessagePreviewVariant = 'card' | 'dialog';

interface MessagePreviewStyle {
  wrapperClassName: string;
  itemClassName: string;
  labelClassName: string;
  iconClassName: string;
  contentClassName: string;
  /** card nests label+content inside the same bg block as the icon; dialog renders the label above a bordered block. */
  labelInsideItem: boolean;
}

const messagePreviewStyles: Record<
  ReservationMessagePreviewVariant,
  MessagePreviewStyle
> = {
  card: {
    wrapperClassName:
      'mt-3 block w-full cursor-pointer space-y-2 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none',
    itemClassName:
      'flex items-start gap-2 rounded-lg bg-background-bottom/40 p-2.5 text-xs transition-colors hover:bg-background-bottom/60 sm:text-sm',
    labelClassName: 'text-11 font-medium text-text-tertiary sm:text-xs',
    iconClassName: 'mt-0.5 size-3.5 shrink-0 text-text-tertiary sm:size-4',
    contentClassName:
      'mt-0.5 line-clamp-2 break-words whitespace-pre-wrap text-text-primary',
    labelInsideItem: true,
  },
  dialog: {
    wrapperClassName:
      'mt-6 block w-full cursor-pointer space-y-6 rounded-sm text-left focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none',
    itemClassName:
      'flex items-start gap-2 rounded-2xl border bg-background-bottom/40 p-4 text-xs transition-colors hover:bg-background-bottom/60 sm:text-sm',
    labelClassName: 'mb-2 text-sm font-medium text-text-primary',
    iconClassName: 'mt-0.5 size-4 shrink-0 text-text-tertiary',
    contentClassName:
      'line-clamp-2 break-words whitespace-pre-wrap text-text-primary',
    labelInsideItem: false,
  },
};

interface ReservationMessagePreviewProps {
  reservation: Reservation;
  // Which role the current user is browsing as. Only used for analytics when
  // opening the full-conversation dialog.
  sourceRole: 'mentor' | 'mentee';
  variant?: ReservationMessagePreviewVariant;
}

/**
 * Truncated mentee/mentor message preview shared by ReservationCard and
 * ReservationIdentity. Always opens ReservationConversationDialog on click so
 * long messages have one consistent way to be read in full everywhere.
 */
export function ReservationMessagePreview({
  reservation,
  sourceRole,
  variant = 'dialog',
}: ReservationMessagePreviewProps) {
  const { menteeMessage, mentorMessage } = reservation;
  if (!menteeMessage && !mentorMessage) return null;

  const style = messagePreviewStyles[variant];

  return (
    <ReservationConversationDialog
      reservation={reservation}
      sourceRole={sourceRole}
      trigger={
        <div
          role="button"
          tabIndex={0}
          aria-label="查看完整訊息"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.currentTarget.click();
            }
          }}
          className={style.wrapperClassName}
        >
          {menteeMessage ? (
            <MessagePreviewItem
              label="學員留言"
              content={menteeMessage.content}
              style={style}
            />
          ) : null}
          {mentorMessage ? (
            <MessagePreviewItem
              label="導師回覆"
              content={mentorMessage.content}
              style={style}
            />
          ) : null}
        </div>
      }
    />
  );
}

function MessagePreviewItem({
  label,
  content,
  style,
}: {
  label: string;
  content: string;
  style: MessagePreviewStyle;
}) {
  if (!style.labelInsideItem) {
    return (
      <div>
        <div className={style.labelClassName}>{label}</div>
        <div className={style.itemClassName}>
          <MessageSquare className={style.iconClassName} aria-hidden />
          <p className={style.contentClassName}>{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={style.itemClassName}>
      <MessageSquare className={style.iconClassName} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className={style.labelClassName}>{label}</div>
        <p className={style.contentClassName}>{content}</p>
      </div>
    </div>
  );
}
