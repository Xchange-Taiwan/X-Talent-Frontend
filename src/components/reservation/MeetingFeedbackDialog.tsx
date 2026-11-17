'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContentFrame,
  DialogOverlay,
  DialogPortal,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useMeetingFeedbackController } from '@/hooks/user/reservation/useMeetingFeedbackForm';
import { cn } from '@/lib/utils';
import type {
  MeetingFeedbackMode,
  MeetingFeedbackStep,
} from '@/schemas/meetingFeedbackSchema';
import type { Reservation } from '@/types/reservation';
import type {
  FeedbackViewerRole,
  SubmitReservationFeedbackRequest,
  UpdateReservationFeedbackRequest,
} from '@/types/reservationFeedback';

import {
  AttendanceStepContent,
  MeetingFeedbackFooter,
  MeetingFeedbackHeader,
  MentorNotHappenedWarning,
  NotHappenedStepContent,
  RatingStepContent,
} from './meeting-feedback';

export type { MeetingFeedbackMode, MeetingFeedbackStep };

export interface MeetingFeedbackDialogProps {
  reservation: Reservation;
  /**
   * Optional multi-session queue (#740 shared design). When length > 1 in create mode,
   * renders segmented progress bar, tilted -5deg back card, and -8deg swipe transition.
   */
  queue?: Reservation[];
  initialQueueIndex?: number;
  /**
   * Optional explicit viewer role ('mentee' | 'mentor'). When omitted, falls back to
   * `activeReservation.viewerRole === 'MENTOR' ? 'mentor' : 'mentee'`.
   */
  viewerRole?: FeedbackViewerRole;
  mode?: MeetingFeedbackMode;
  disabled?: boolean;
  defaultOpen?: boolean;
  hideTrigger?: boolean;
  initialStep?: MeetingFeedbackStep;
  initialRating?: number;
  initialContent?: string;
  onSubmitFeedback?: (
    payload: SubmitReservationFeedbackRequest,
    targetReservation: Reservation
  ) => Promise<void>;
  onUpdateFeedback?: (
    payload: UpdateReservationFeedbackRequest
  ) => Promise<void>;
  onSkipReservation?: (reservation: Reservation) => void;
  onClose?: () => void;
  trigger?: React.ReactNode;
  className?: string;
}

export default function MeetingFeedbackDialog({
  disabled = false,
  hideTrigger = false,
  trigger,
  className,
  ...controllerOptions
}: MeetingFeedbackDialogProps) {
  const ctrl = useMeetingFeedbackController(controllerOptions);
  const contentFieldId = React.useId();
  const noteFieldId = React.useId();

  const defaultTrigger = ctrl.isEditMode ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      className={cn(
        'border-background-border bg-background-white text-text-primary hover:bg-background-hover h-7 rounded-lg px-2.5 text-xs font-medium sm:h-8 sm:px-3',
        className
      )}
    >
      編輯
    </Button>
  ) : (
    <Button
      type="button"
      size="sm"
      disabled={disabled}
      className={cn(
        'bg-brand-500 text-text-primary hover:bg-brand-400 h-8 rounded-md px-3.5 text-xs font-medium sm:h-9 sm:px-4 sm:text-sm',
        className
      )}
    >
      {ctrl.isMentor ? '確認會談' : '填寫回饋'}
    </Button>
  );

  return (
    <Dialog open={ctrl.open} onOpenChange={ctrl.handleOpenChange}>
      {!hideTrigger ? (
        <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      ) : null}

      <DialogPortal>
        <DialogOverlay
          data-testid="feedback-dialog-overlay"
          className="bg-text-primary/20 motion-safe:animate-feedback-overlay-in backdrop-blur-[3px]"
        />

        <DialogContentFrame
          onEscapeKeyDown={ctrl.handleEscapeKeyDown}
          onPointerDownOutside={ctrl.guardOutsideInteraction}
          onInteractOutside={ctrl.guardOutsideInteraction}
          className="motion-safe:animate-feedback-dialog-in w-[calc(100%-2rem)] max-w-[468px] gap-0 overflow-visible border-0 bg-transparent p-0 shadow-none sm:rounded-lg"
        >
          {ctrl.hasRemainingQueueCard ? (
            <div
              aria-hidden="true"
              data-testid="feedback-queue-back-card"
              className="border-background-border bg-background-white pointer-events-none absolute top-1.5 right-1.5 -bottom-1.5 left-1.5 -z-10 rotate-[-5deg] rounded-lg border shadow-sm transition-transform duration-300"
            />
          ) : null}

          <div
            ref={ctrl.surfaceRef}
            data-testid="feedback-dialog-surface"
            data-queue-motion={ctrl.queueMotionState}
            className={cn(
              'border-background-border bg-background-white text-text-primary relative flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-lg border shadow-lg sm:max-h-[calc(100dvh-1.5rem)]',
              ctrl.queueMotionState === 'swiping-out' &&
                'motion-safe:animate-feedback-card-out',
              ctrl.queueMotionState === 'promoting' &&
                'motion-safe:animate-feedback-card-promote'
            )}
          >
            <MeetingFeedbackHeader
              activeReservation={ctrl.activeReservation}
              queueItems={ctrl.queueItems}
              queueIndex={ctrl.queueIndex}
              isQueueMode={ctrl.isQueueMode}
              isMentor={ctrl.isMentor}
              isSubmitting={ctrl.isSubmitting}
              isTransitioningCard={ctrl.isTransitioningCard}
              tooltipDismissSignal={ctrl.tooltipDismissSignal}
              onSkipTooltipOpenChange={ctrl.setIsSkipTooltipOpen}
              onCloseOrSkipClick={ctrl.handleCloseOrSkipClick}
            />

            <form
              onSubmit={ctrl.handleFormSubmit}
              noValidate
              className="flex min-h-0 flex-1 flex-col"
            >
              <div
                data-clarity-mask="true"
                className={cn(
                  'min-h-0 flex-1 overflow-y-auto px-5 sm:px-6',
                  ctrl.effectiveStep === 'not-happened' ? 'pt-3 pb-2' : 'py-4'
                )}
              >
                <div
                  key={`${ctrl.activeReservation.id}-${ctrl.effectiveStep}`}
                  className={cn(
                    'motion-safe:animate-feedback-step-in',
                    ctrl.effectiveStep === 'not-happened'
                      ? 'space-y-2.5'
                      : 'space-y-4'
                  )}
                >
                  {ctrl.effectiveStep === 'attendance' ? (
                    <AttendanceStepContent
                      meetingHappened={ctrl.values.meetingHappened}
                      disabled={ctrl.isSubmitting || ctrl.isTransitioningCard}
                      onSelectMeetingHappened={ctrl.handleSelectMeetingHappened}
                    />
                  ) : ctrl.effectiveStep === 'rating' ? (
                    <RatingStepContent
                      isEditMode={ctrl.isEditMode}
                      rating={ctrl.values.rating}
                      content={ctrl.values.content}
                      contentError={ctrl.contentError}
                      contentFieldId={contentFieldId}
                      isSubmitting={ctrl.isSubmitting}
                      contentRegistration={ctrl.register('content')}
                      tooltipDismissSignal={ctrl.tooltipDismissSignal}
                      onMaskTooltipOpenChange={ctrl.setIsMaskTooltipOpen}
                      onRatingChange={ctrl.handleRatingChange}
                    />
                  ) : (
                    <NotHappenedStepContent
                      isMentor={ctrl.isMentor}
                      notHappenedReason={ctrl.values.notHappenedReason}
                      notHappenedNote={ctrl.values.notHappenedNote}
                      noteError={ctrl.noteError}
                      noteFieldId={noteFieldId}
                      isSubmitting={ctrl.isSubmitting}
                      noteRegistration={ctrl.register('notHappenedNote')}
                      onSelectReason={ctrl.handleSelectNotHappenedReason}
                    />
                  )}
                </div>
              </div>

              {ctrl.effectiveStep === 'not-happened' && ctrl.isMentor ? (
                <div className="shrink-0 px-5 pt-1 pb-2 sm:px-6">
                  <MentorNotHappenedWarning />
                </div>
              ) : null}

              <MeetingFeedbackFooter
                footerModel={ctrl.footerModel}
                onNextFromAttendance={ctrl.handleNextFromAttendance}
                onBackToAttendance={ctrl.handleBackToAttendance}
                onCancelEdit={ctrl.handleCancelEdit}
              />
            </form>
          </div>
        </DialogContentFrame>
      </DialogPortal>
    </Dialog>
  );
}
