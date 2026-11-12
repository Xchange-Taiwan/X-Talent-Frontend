'use client';

import { ChevronDown, ChevronUp, Star } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FEEDBACK_FORM_URL } from '@/constant/externalLinks';
import type { HistoryFeedbackBlockModel } from '@/lib/reservation/resolveHistoryFeedbackState';
import { FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

export interface UnpublicizedNoticeToggleProps {
  expanded: boolean;
  onToggle: () => void;
  controlsId?: string;
}

export function UnpublicizedNoticeToggleButton({
  expanded,
  onToggle,
  controlsId,
}: UnpublicizedNoticeToggleProps) {
  const label = expanded ? '收合評價未公開說明' : '展開評價未公開說明';
  const Icon = expanded ? ChevronUp : ChevronDown;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={controlsId}
      aria-label={label}
      title={label}
      className={cn(
        'border-background-border/60 bg-background-bottom text-text-secondary hover:bg-background-hover inline-flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors',
        FOCUS_RING_CLASSES
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
    </button>
  );
}

export interface ReservationFeedbackBlockProps {
  model: HistoryFeedbackBlockModel;
  /**
   * Optional custom edit trigger element (e.g. `MeetingFeedbackDialog` in `mode="edit"`).
   * Only rendered when `model.canEdit` is true.
   */
  editAction?: React.ReactNode;
  onEdit?: () => void;
  /**
   * Controlled expand/collapse state for the unpublicized feedback notice (#734).
   * When `onToggleNotice` is provided by the parent card header, the amber
   * `評價未公開` badge and chevron toggle live in the card header slot; when
   * omitted (standalone rendering), they render inline in this block's header.
   */
  isNoticeExpanded?: boolean;
  defaultNoticeExpanded?: boolean;
  onToggleNotice?: () => void;
  noticeId?: string;
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
  isNoticeExpanded,
  defaultNoticeExpanded = true,
  onToggleNotice,
  noticeId,
}: ReservationFeedbackBlockProps) {
  const generatedNoticeId = React.useId();
  const resolvedNoticeId = noticeId ?? generatedNoticeId;
  const [internalExpanded, setInternalExpanded] = React.useState(
    defaultNoticeExpanded
  );

  const expanded = isNoticeExpanded ?? internalExpanded;
  const handleToggleNotice =
    onToggleNotice ?? (() => setInternalExpanded((prev) => !prev));
  const showInlineUnpublicizedHeader = !onToggleNotice;

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
        className="mt-3 space-y-2.5"
      >
        {expanded ? (
          <div
            id={resolvedNoticeId}
            role="note"
            data-testid="unpublicized-feedback-notice"
            className="border-status-warning-default/40 bg-status-warning-active/15 space-y-1 rounded-xl border p-3 sm:p-3.5"
          >
            <p className="text-text-primary text-xs font-semibold sm:text-sm">
              評價未公開
            </p>
            <p className="text-text-secondary text-xs leading-relaxed sm:text-sm">
              {renderNoticeWithFeedbackLink(model.notice)}
            </p>
          </div>
        ) : null}

        <div className="border-background-border bg-background-bottom space-y-2 rounded-xl border p-3 sm:p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-text-secondary text-xs font-medium">
                我的評價
              </span>
              {showInlineUnpublicizedHeader ? (
                <div className="flex items-center gap-1.5">
                  <Badge variant="warning" role="status">
                    評價未公開
                  </Badge>
                  <UnpublicizedNoticeToggleButton
                    expanded={expanded}
                    onToggle={handleToggleNotice}
                    controlsId={resolvedNoticeId}
                  />
                </div>
              ) : null}
            </div>
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
