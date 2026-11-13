'use client';

import { ChevronDown, Star } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { FEEDBACK_FORM_URL } from '@/constant/externalLinks';
import type {
  HistoryFeedbackBlockModel,
  HistoryHeaderAction,
} from '@/lib/reservation/resolveHistoryFeedbackState';
import { cn } from '@/lib/utils';

export const EMPTY_FEEDBACK_CONTENT_TEXT = '沒有留下文字回饋。';

export type CollapsibleFeedbackHeaderAction = Extract<
  HistoryHeaderAction,
  { kind: 'feedback-toggle' | 'unpublicized-toggle' }
>;

export interface ReservationFeedbackHeaderToggleProps {
  action: CollapsibleFeedbackHeaderAction;
  isExpanded: boolean;
  onToggle: () => void;
  panelId?: string;
}

export function ReservationFeedbackHeaderToggle({
  action,
  isExpanded,
  onToggle,
  panelId,
}: ReservationFeedbackHeaderToggleProps) {
  if (action.kind === 'feedback-toggle') {
    return (
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={onToggle}
        className="text-brand-700 hover:bg-brand-50 focus-visible:ring-brand-500 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none sm:text-sm"
      >
        <span>{action.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-4 transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
        />
      </button>
    );
  }

  const tooltipLabel = isExpanded
    ? action.collapseTooltip
    : action.expandTooltip;

  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        role="status"
        className="bg-status-warning-surface text-status-warning-text inline-flex items-center rounded-md px-2 py-0.5 text-xs font-normal"
      >
        {action.badgeLabel}
      </span>

      <Tooltip
        content={tooltipLabel}
        side="top"
        align="end"
        testId="unpublicized-toggle-tooltip"
        contentClassName="mb-1.5 px-2.5 py-1.5 font-medium whitespace-nowrap"
      >
        <button
          type="button"
          aria-label={tooltipLabel}
          aria-expanded={isExpanded}
          aria-controls={panelId}
          onClick={onToggle}
          className={cn(
            'text-text-secondary hover:bg-background-bottom hover:text-text-primary focus-visible:ring-brand-500 inline-flex size-7 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none',
            isExpanded && 'bg-background-bottom text-text-primary'
          )}
        >
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-4 transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
          />
        </button>
      </Tooltip>
    </div>
  );
}

export interface ReservationFeedbackBlockProps {
  id?: string;
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
  id,
  model,
  editAction,
  onEdit,
}: ReservationFeedbackBlockProps) {
  if (model.kind === 'mentor-record') {
    return (
      <div
        id={id}
        data-testid="reservation-feedback-mentor-record"
        className="border-background-border/70 bg-background-bottom-secondary motion-safe:animate-feedback-step-in mt-3 rounded-lg border px-3.5 py-3 sm:px-4 sm:py-3.5"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-text-secondary text-xs font-medium">
            會談紀錄
          </span>
          <span
            data-testid="mentor-attendance-record"
            className="text-brand-700 text-xs font-medium sm:text-sm"
          >
            {model.attendanceLabel}
          </span>
        </div>
      </div>
    );
  }

  const trimmedContent = model.content.trim();
  const hasContent = trimmedContent.length > 0;

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
        id={id}
        data-testid="reservation-feedback-unpublicized"
        className="motion-safe:animate-feedback-step-in mt-3 space-y-2.5"
      >
        <div
          role="note"
          className="border-status-warning-border bg-status-warning-surface/70 rounded-lg border px-4 py-3"
        >
          <p className="text-text-primary text-xs font-semibold sm:text-sm">
            評價未公開
          </p>
          <p className="text-text-secondary mt-1 text-xs leading-relaxed sm:text-sm">
            {renderNoticeWithFeedbackLink(model.notice)}
          </p>
        </div>

        <div className="border-background-border/70 bg-background-bottom-secondary rounded-lg border px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-text-secondary text-xs font-medium">
              我的回饋
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

          {hasContent ? (
            <p className="text-text-secondary mt-1.5 text-xs leading-relaxed whitespace-pre-line sm:text-sm">
              {trimmedContent}
            </p>
          ) : (
            <p className="text-text-tertiary mt-1.5 text-xs leading-relaxed sm:text-sm">
              {EMPTY_FEEDBACK_CONTENT_TEXT}
            </p>
          )}
        </div>
      </div>
    );
  }

  const isMentorReceivedRating =
    model.label === '學員評價' && Boolean(model.authorMaskedName);

  if (isMentorReceivedRating) {
    return (
      <div
        id={id}
        data-testid="reservation-feedback-public"
        className="border-background-border/70 bg-background-bottom-secondary motion-safe:animate-feedback-step-in mt-3 rounded-lg border px-3.5 py-3 sm:px-4 sm:py-3.5"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-text-secondary text-xs font-medium">
            {model.label}
          </span>
          {model.mentorAttendanceLabel ? (
            <span
              data-testid="mentor-attendance-record"
              className="text-brand-700 text-xs font-medium"
            >
              {model.mentorAttendanceLabel}
            </span>
          ) : null}
        </div>

        <div
          data-testid="mentor-feedback-meta"
          className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs sm:text-sm"
        >
          <span className="text-text-primary font-semibold">
            {model.authorMaskedName}
          </span>
          <span className="text-text-tertiary" aria-hidden="true">
            ·
          </span>
          <span className="text-brand-700 inline-flex items-center gap-1 font-semibold tabular-nums">
            <Star
              className="fill-brand-700 text-brand-700 size-3.5"
              aria-hidden="true"
            />
            <span>{model.rating} / 10</span>
          </span>
          {model.formattedDate ? (
            <>
              <span className="text-text-tertiary" aria-hidden="true">
                ·
              </span>
              <time className="text-text-tertiary tabular-nums">
                {model.formattedDate}
              </time>
            </>
          ) : null}
        </div>

        {hasContent ? (
          <p className="text-text-primary mt-1.5 text-xs leading-relaxed whitespace-pre-line sm:text-sm">
            {trimmedContent}
          </p>
        ) : (
          <p className="text-text-tertiary mt-1.5 text-xs leading-relaxed sm:text-sm">
            {EMPTY_FEEDBACK_CONTENT_TEXT}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      id={id}
      data-testid="reservation-feedback-public"
      className="border-background-border/70 bg-background-bottom-secondary motion-safe:animate-feedback-step-in mt-3 rounded-lg border px-3.5 py-3 sm:px-4 sm:py-3.5"
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

      {hasContent ? (
        <p className="text-text-primary mt-1.5 text-xs leading-relaxed whitespace-pre-line sm:text-sm">
          {trimmedContent}
        </p>
      ) : (
        <p className="text-text-tertiary mt-1.5 text-xs leading-relaxed sm:text-sm">
          {EMPTY_FEEDBACK_CONTENT_TEXT}
        </p>
      )}
    </div>
  );
}
