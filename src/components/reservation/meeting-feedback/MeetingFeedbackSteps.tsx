'use client';

import { Info, Loader2 } from 'lucide-react';
import * as React from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { FeedbackStarRating } from '@/components/reservation/FeedbackStarRating';
import { Button } from '@/components/ui/button';
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  MAX_FEEDBACK_CONTENT_LENGTH,
  MAX_NOT_HAPPENED_NOTE_LENGTH,
  MENTOR_NOT_HAPPENED_WARNING_TEXT,
} from '@/schemas/meetingFeedbackSchema';
import {
  NOT_HAPPENED_REASON_LABELS,
  NOT_HAPPENED_REASONS,
  type NotHappenedReason,
} from '@/types/reservationFeedback';

import { FeedbackRadioOption } from './FeedbackRadioOption';

export interface AttendanceStepContentProps {
  meetingHappened: boolean | null;
  disabled?: boolean;
  onSelectMeetingHappened: (value: boolean) => void;
}

export function AttendanceStepContent({
  meetingHappened,
  disabled = false,
  onSelectMeetingHappened,
}: AttendanceStepContentProps) {
  return (
    <>
      <DialogHeader className="space-y-1 text-left">
        <p className="text-brand-700 text-xs font-medium">
          步驟 1 / 2 · 確認會談
        </p>
        <DialogTitle className="text-text-primary text-18 font-semibold">
          這場會談是否順利進行？
        </DialogTitle>
        <DialogDescription className="text-text-secondary text-sm">
          先告訴我們這次會談的狀況。
        </DialogDescription>
      </DialogHeader>

      <div
        role="radiogroup"
        aria-label="這場會談是否順利進行"
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3"
      >
        {(
          [
            { label: '有進行', value: true },
            { label: '沒有進行', value: false },
          ] as const
        ).map((option) => (
          <FeedbackRadioOption
            key={option.label}
            name="meetingHappened"
            label={option.label}
            checked={meetingHappened === option.value}
            disabled={disabled}
            onSelect={() => onSelectMeetingHappened(option.value)}
          />
        ))}
      </div>
    </>
  );
}

export interface RatingStepContentProps {
  isEditMode: boolean;
  rating: number;
  content: string;
  contentError?: string;
  contentFieldId: string;
  isSubmitting: boolean;
  contentRegistration: UseFormRegisterReturn;
  tooltipDismissSignal: number;
  onMaskTooltipOpenChange: (open: boolean) => void;
  onRatingChange: (value: number) => void;
}

export function RatingStepContent({
  isEditMode,
  rating,
  content,
  contentError,
  contentFieldId,
  isSubmitting,
  contentRegistration,
  tooltipDismissSignal,
  onMaskTooltipOpenChange,
  onRatingChange,
}: RatingStepContentProps) {
  const hasContentError = Boolean(contentError);

  return (
    <>
      <DialogHeader className="relative z-20 space-y-1 text-left">
        <p className="text-brand-700 text-xs font-medium">
          {isEditMode ? '已送出回饋 · 不限次數編輯' : '步驟 2 / 2 · 交流回饋'}
        </p>

        <div className="flex items-center gap-1.5">
          <DialogTitle className="text-text-primary text-18 font-semibold">
            {isEditMode ? '編輯回饋' : '為本次會議評分'}
          </DialogTitle>

          <Tooltip
            content="顯示時不會完整公開姓名與個人資料"
            side="right"
            align="center"
            pinOnClick
            dismissSignal={tooltipDismissSignal}
            onOpenChange={onMaskTooltipOpenChange}
            testId="feedback-name-masking-tooltip"
            contentClassName="w-max max-w-[calc(100vw-15rem)] px-2.5 py-1.5 sm:max-w-60"
          >
            <button
              type="button"
              aria-label="姓名遮罩說明"
              className="text-text-secondary hover:bg-background-bottom hover:text-text-primary focus-visible:ring-brand-500 inline-flex size-6 items-center justify-center rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Info className="size-4" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>

        <DialogDescription className="sr-only">
          請選擇 1 至 10 分並填寫選填文字回饋。
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-text-primary text-sm font-medium">評分</span>
          <span data-testid="meeting-rating-value" className="tabular-nums">
            <span className="text-brand-700 text-lg font-semibold">
              {rating}
            </span>
            <span className="text-text-secondary text-xs"> / 10</span>
          </span>
        </div>

        <FeedbackStarRating
          value={rating}
          disabled={isSubmitting}
          ariaLabel="整體滿意度"
          onChange={onRatingChange}
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={contentFieldId}
          className="text-text-primary block text-sm font-medium"
        >
          文字回饋{' '}
          <span className="text-text-secondary font-normal">（選填）</span>
        </label>
        <Textarea
          id={contentFieldId}
          placeholder="分享這次交流的收穫，或給導師一些建議⋯"
          rows={5}
          aria-invalid={hasContentError}
          disabled={isSubmitting}
          className="resize-none overflow-y-auto text-sm font-normal"
          {...contentRegistration}
        />
        <div className="flex items-center justify-between gap-2 text-xs">
          {contentError ? (
            <p role="alert" className="text-status-error-default">
              {contentError}
            </p>
          ) : (
            <span />
          )}
          <span
            data-testid="feedback-content-counter"
            className={cn(
              'tabular-nums',
              hasContentError
                ? 'text-status-error-default font-medium'
                : 'text-text-secondary'
            )}
          >
            {content.length} / {MAX_FEEDBACK_CONTENT_LENGTH}
          </span>
        </div>
      </div>
    </>
  );
}

export interface MentorNotHappenedWarningProps {
  className?: string;
}

export function MentorNotHappenedWarning({
  className,
}: MentorNotHappenedWarningProps) {
  return (
    <div
      role="note"
      data-testid="mentor-not-happened-warning"
      className={cn(
        'border-status-warning-border bg-status-warning-surface text-status-warning-text flex items-start gap-2 rounded-lg border px-3.5 py-2 text-xs leading-relaxed',
        className
      )}
    >
      <Info
        className="text-status-warning-text mt-0.5 size-4 shrink-0"
        aria-hidden="true"
      />
      <p>{MENTOR_NOT_HAPPENED_WARNING_TEXT}</p>
    </div>
  );
}

export interface NotHappenedStepContentProps {
  notHappenedReason: NotHappenedReason | null;
  notHappenedNote: string;
  noteError?: string;
  noteFieldId: string;
  isSubmitting: boolean;
  noteRegistration: UseFormRegisterReturn;
  onSelectReason: (reason: NotHappenedReason) => void;
}

export function NotHappenedStepContent({
  notHappenedReason,
  notHappenedNote,
  noteError,
  noteFieldId,
  isSubmitting,
  noteRegistration,
  onSelectReason,
}: NotHappenedStepContentProps) {
  const showNoteField = notHappenedReason === 'OTHER';
  const visibleNoteError = showNoteField ? noteError : undefined;
  const hasNoteError = Boolean(visibleNoteError);

  return (
    <>
      <DialogHeader className="space-y-0.5 text-left">
        <p className="text-brand-700 text-xs font-medium">
          步驟 2 / 2 · 會談狀況
        </p>
        <DialogTitle className="text-text-primary text-18 font-semibold">
          未進行會談的原因
        </DialogTitle>
        <DialogDescription className="sr-only">
          請選擇未進行會談的原因。
        </DialogDescription>
      </DialogHeader>

      <div>
        <div className="space-y-1.5">
          <p className="text-text-primary text-sm font-medium">
            為何沒有成功進行？
          </p>
          <div
            role="radiogroup"
            aria-label="為何沒有成功進行"
            className="space-y-1.5"
          >
            {NOT_HAPPENED_REASONS.map((reason) => (
              <FeedbackRadioOption
                key={reason}
                name="notHappenedReason"
                value={reason}
                label={NOT_HAPPENED_REASON_LABELS[reason]}
                checked={notHappenedReason === reason}
                disabled={isSubmitting}
                density="compact"
                onSelect={() => onSelectReason(reason)}
              />
            ))}
          </div>
        </div>

        <div
          data-testid="not-happened-note-collapse"
          data-expanded={showNoteField ? 'true' : 'false'}
          aria-hidden={!showNoteField}
          className={cn(
            'grid transition-all duration-200 ease-out motion-reduce:transition-none',
            showNoteField
              ? 'visible mt-2.5 grid-rows-[1fr] opacity-100'
              : 'pointer-events-none invisible mt-0 grid-rows-[0fr] opacity-0'
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-1 px-0.5 pt-0.5 pb-0.5">
              <label
                htmlFor={noteFieldId}
                className="text-text-primary block text-sm font-medium"
              >
                補充說明{' '}
                <span className="text-text-secondary font-normal">
                  （選填）
                </span>
              </label>
              <Textarea
                id={noteFieldId}
                rows={2}
                placeholder="說說發生了什麼事…"
                aria-invalid={hasNoteError}
                tabIndex={showNoteField ? undefined : -1}
                className="min-h-12 resize-none overflow-y-auto py-1.5 text-sm font-normal"
                {...noteRegistration}
                disabled={isSubmitting || !showNoteField}
              />
              <div className="flex items-center justify-between gap-2 text-xs">
                {visibleNoteError ? (
                  <p role="alert" className="text-status-error-default">
                    {visibleNoteError}
                  </p>
                ) : (
                  <span />
                )}
                <span
                  data-testid="feedback-note-counter"
                  className={cn(
                    'tabular-nums',
                    hasNoteError
                      ? 'text-status-error-default font-medium'
                      : 'text-text-secondary'
                  )}
                >
                  {notHappenedNote.length} / {MAX_NOT_HAPPENED_NOTE_LENGTH}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export interface MeetingFeedbackFooterProps {
  effectiveStep: 'attendance' | 'rating' | 'not-happened';
  isEditMode: boolean;
  isMentor?: boolean;
  meetingHappened?: boolean | null;
  isSubmitting: boolean;
  isTransitioningCard: boolean;
  canProceedAttendance: boolean;
  canSubmitStep2: boolean;
  hasRemainingQueueCard?: boolean;
  onNextFromAttendance: () => void;
  onBackToAttendance: () => void;
  onCancelEdit: () => void;
}

export function MeetingFeedbackFooter({
  effectiveStep,
  isEditMode,
  isMentor = false,
  meetingHappened = null,
  isSubmitting,
  isTransitioningCard,
  canProceedAttendance,
  canSubmitStep2,
  hasRemainingQueueCard = false,
  onNextFromAttendance,
  onBackToAttendance,
  onCancelEdit,
}: MeetingFeedbackFooterProps) {
  if (effectiveStep === 'attendance') {
    if (isMentor && meetingHappened !== false) {
      if (meetingHappened === true) {
        return (
          <DialogFooter className="bg-background-white flex shrink-0 flex-row justify-end px-5 pt-2 pb-5 sm:space-x-0 sm:px-6 sm:pb-6">
            <Button
              key="mentor-submit-happened"
              type="submit"
              disabled={
                !canProceedAttendance || isSubmitting || isTransitioningCard
              }
              className="bg-brand-500 text-text-primary hover:bg-brand-400 rounded-md px-4 disabled:opacity-45"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  送出中...
                </>
              ) : (
                '確定送出'
              )}
            </Button>
          </DialogFooter>
        );
      }

      return (
        <DialogFooter className="bg-background-white flex shrink-0 flex-row justify-end px-5 pt-2 pb-5 sm:space-x-0 sm:px-6 sm:pb-6">
          <Button
            key="mentor-submit-unselected"
            type="button"
            disabled
            className="bg-brand-500 text-text-primary hover:bg-brand-400 rounded-md px-4 disabled:opacity-45"
          >
            確定送出
          </Button>
        </DialogFooter>
      );
    }

    return (
      <DialogFooter className="bg-background-white flex shrink-0 flex-row justify-end px-5 pt-2 pb-5 sm:space-x-0 sm:px-6 sm:pb-6">
        <Button
          key="attendance-next"
          type="button"
          disabled={
            !canProceedAttendance || isSubmitting || isTransitioningCard
          }
          onClick={onNextFromAttendance}
          className="bg-brand-500 text-text-primary hover:bg-brand-400 rounded-md px-4 disabled:opacity-45"
        >
          <span>下一步</span>
        </Button>
      </DialogFooter>
    );
  }

  return (
    <DialogFooter
      className={cn(
        'bg-background-white flex shrink-0 flex-row items-center justify-between gap-3 px-5 sm:justify-between sm:space-x-0 sm:px-6',
        effectiveStep === 'not-happened'
          ? isMentor
            ? 'pt-1.5 pb-4 sm:pb-5'
            : 'border-background-border/70 border-t py-3 sm:py-3.5'
          : 'pt-1 pb-5 sm:pb-6'
      )}
    >
      {isEditMode ? (
        <Button
          type="button"
          variant="ghost"
          disabled={isSubmitting}
          onClick={onCancelEdit}
          className="text-text-secondary hover:bg-background-bottom hover:text-text-primary rounded-md px-2.5"
        >
          取消
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          disabled={isSubmitting}
          onClick={onBackToAttendance}
          className="text-text-secondary hover:bg-background-bottom hover:text-text-primary rounded-md px-2.5"
        >
          上一步
        </Button>
      )}

      <Button
        type="submit"
        disabled={!canSubmitStep2 || isSubmitting || isTransitioningCard}
        className="bg-brand-500 text-text-primary hover:bg-brand-400 rounded-md px-4"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-1.5 size-4 animate-spin" />
            {isEditMode ? '儲存中...' : '送出中...'}
          </>
        ) : isEditMode ? (
          '儲存'
        ) : hasRemainingQueueCard ? (
          '送出並填下一場'
        ) : isMentor ? (
          '送出'
        ) : (
          '送出回饋'
        )}
      </Button>
    </DialogFooter>
  );
}
