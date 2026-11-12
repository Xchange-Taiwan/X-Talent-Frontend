import { AlertCircle, Star } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { FEEDBACK_FORM_URL } from '@/constant/externalLinks';
import type { HistoryFeedbackBlockModel } from '@/lib/reservation/resolveHistoryFeedbackState';

export interface ReservationFeedbackBlockProps {
  model: HistoryFeedbackBlockModel;
  /**
   * Optional custom edit trigger element (e.g. `MeetingFeedbackDialog` in `mode="edit"`).
   * Only rendered when `model.canEdit` is true.
   */
  editAction?: React.ReactNode;
  onEdit?: () => void;
}

const FEEDBACK_LINK_LABEL = '回饋表單';

function renderNoticeWithFeedbackLink(notice: string): React.ReactNode {
  const idx = notice.indexOf(FEEDBACK_LINK_LABEL);
  if (idx === -1) {
    return notice;
  }

  const before = notice.slice(0, idx);
  const after = notice.slice(idx + FEEDBACK_LINK_LABEL.length);

  return (
    <>
      {before}
      <a
        href={FEEDBACK_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-700 font-medium underline underline-offset-2 hover:opacity-80"
      >
        {FEEDBACK_LINK_LABEL}
      </a>
      {after}
    </>
  );
}

export function ReservationFeedbackBlock({
  model,
  editAction,
  onEdit,
}: ReservationFeedbackBlockProps) {
  const editControl = model.canEdit
    ? (editAction ?? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="border-background-border bg-background-white text-text-primary hover:bg-background-hover h-7 rounded-lg px-2.5 text-xs font-medium sm:h-8 sm:px-3"
        >
          編輯
        </Button>
      ))
    : null;

  if (model.kind === 'unpublicized') {
    return (
      <div
        data-testid="reservation-feedback-unpublicized"
        className="border-background-border bg-background-bottom mt-3 space-y-2 rounded-xl border p-3 sm:p-3.5"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-text-secondary text-xs font-medium">
            我的評價
          </span>
          <div className="flex items-center gap-2.5">
            <span className="text-text-secondary inline-flex items-center gap-1 text-xs font-semibold tabular-nums sm:text-sm">
              <Star
                className="fill-text-tertiary text-text-tertiary size-3.5"
                aria-hidden="true"
              />
              <span>{model.rating} / 10</span>
            </span>
            {editControl}
          </div>
        </div>

        {model.content ? (
          <p className="text-text-secondary text-xs leading-relaxed whitespace-pre-line sm:text-sm">
            {model.content}
          </p>
        ) : null}

        <div
          role="note"
          className="border-background-border bg-background-white text-text-secondary flex items-start gap-2 rounded-lg border p-2.5 text-xs leading-relaxed"
        >
          <AlertCircle
            className="text-text-tertiary mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <p>{renderNoticeWithFeedbackLink(model.notice)}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="reservation-feedback-public"
      className="border-background-border/70 bg-background-bottom-secondary mt-3 rounded-xl border p-3 sm:p-3.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-text-secondary text-xs font-medium">
          {model.label}
        </span>
        <div className="flex items-center gap-2.5">
          <span className="text-brand-700 inline-flex items-center gap-1 text-xs font-semibold tabular-nums sm:text-sm">
            <Star
              className="fill-brand-700 text-brand-700 size-3.5"
              aria-hidden="true"
            />
            <span>{model.rating} / 10</span>
          </span>
          {editControl}
        </div>
      </div>

      {model.content ? (
        <p className="text-text-primary mt-1.5 text-xs leading-relaxed whitespace-pre-line sm:text-sm">
          {model.content}
        </p>
      ) : null}
    </div>
  );
}
