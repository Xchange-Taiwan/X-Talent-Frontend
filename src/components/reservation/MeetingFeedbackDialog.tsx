'use client';

import { X } from 'lucide-react';
import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContentFrame,
  DialogOverlay,
  DialogPortal,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { useFeedbackQueueMotion } from '@/hooks/user/reservation/useFeedbackQueueMotion';
import {
  DEFAULT_MEETING_FEEDBACK_FORM_VALUES,
  useMeetingFeedbackForm,
} from '@/hooks/user/reservation/useMeetingFeedbackForm';
import { useStepHeightMorph } from '@/hooks/user/reservation/useStepHeightMorph';
import { getAvatarThumbUrl } from '@/lib/avatar/getAvatarThumbUrl';
import { getInitials } from '@/lib/avatar/getInitials';
import {
  RESERVATION_CONFLICT_MESSAGE,
  ReservationVersionConflictError,
} from '@/lib/reservation/reservationConflictError';
import { cn } from '@/lib/utils';
import {
  DEFAULT_MEETING_RATING,
  MAX_FEEDBACK_CONTENT_LENGTH,
  MAX_NOT_HAPPENED_NOTE_LENGTH,
  type MeetingFeedbackFormValues,
  toSubmitFeedbackPayload,
  toUpdateFeedbackPayload,
} from '@/schemas/meetingFeedbackSchema';
import type { Reservation } from '@/types/reservation';
import type {
  SubmitReservationFeedbackRequest,
  UpdateReservationFeedbackRequest,
} from '@/types/reservationFeedback';

import {
  AttendanceStepContent,
  MeetingFeedbackFooter,
  NotHappenedStepContent,
  RatingStepContent,
} from './meeting-feedback';

export type MeetingFeedbackStep = 'attendance' | 'rating' | 'not-happened';
export type MeetingFeedbackMode = 'create' | 'edit';

export interface MeetingFeedbackDialogProps {
  reservation: Reservation;
  sourceRole?: 'mentee' | 'mentor';
  /**
   * Optional multi-session queue (#740 shared design). When length > 1 in create mode,
   * renders segmented progress bar, tilted -5deg back card, and -8deg swipe transition.
   */
  queue?: Reservation[];
  initialQueueIndex?: number;
  mode?: MeetingFeedbackMode;
  disabled?: boolean;
  defaultOpen?: boolean;
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

function buildEditBaseValues(
  reservation: Reservation,
  initialRating?: number,
  initialContent?: string
): MeetingFeedbackFormValues {
  return {
    meetingHappened: true,
    rating:
      initialRating ??
      reservation.feedback?.rating?.rating ??
      DEFAULT_MEETING_RATING,
    content: initialContent ?? reservation.feedback?.rating?.content ?? '',
    notHappenedReason: null,
    notHappenedNote: '',
  };
}

function buildCreateInitialValues(
  initialStep: MeetingFeedbackStep,
  initialRating?: number,
  initialContent?: string
): MeetingFeedbackFormValues {
  return {
    ...DEFAULT_MEETING_FEEDBACK_FORM_VALUES,
    meetingHappened:
      initialStep === 'rating'
        ? true
        : initialStep === 'not-happened'
          ? false
          : null,
    rating: initialRating ?? DEFAULT_MEETING_RATING,
    content: initialContent ?? '',
  };
}

export default function MeetingFeedbackDialog({
  reservation,
  sourceRole = 'mentee',
  queue,
  initialQueueIndex = 0,
  mode = 'create',
  disabled = false,
  defaultOpen = false,
  initialStep = 'attendance',
  initialRating,
  initialContent,
  onSubmitFeedback,
  onUpdateFeedback,
  onSkipReservation,
  onClose,
  trigger,
  className,
}: MeetingFeedbackDialogProps) {
  const isEditMode = mode === 'edit';
  const resolvedInitialStep: MeetingFeedbackStep = isEditMode
    ? 'rating'
    : initialStep;

  const [open, setOpen] = React.useState(defaultOpen);
  const [step, setStep] =
    React.useState<MeetingFeedbackStep>(resolvedInitialStep);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isMaskTooltipOpen, setIsMaskTooltipOpen] = React.useState(false);
  const [isSkipTooltipOpen, setIsSkipTooltipOpen] = React.useState(false);
  const [tooltipDismissSignal, setTooltipDismissSignal] = React.useState(0);

  const inFlightRef = React.useRef(false);
  const { toast } = useToast();

  const dismissTooltips = React.useCallback(() => {
    setIsMaskTooltipOpen(false);
    setIsSkipTooltipOpen(false);
    setTooltipDismissSignal((v) => v + 1);
  }, []);

  const baseCreateValues = React.useMemo(
    () =>
      buildCreateInitialValues(
        resolvedInitialStep,
        initialRating,
        initialContent
      ),
    [resolvedInitialStep, initialRating, initialContent]
  );

  const form = useMeetingFeedbackForm(
    isEditMode
      ? buildEditBaseValues(reservation, initialRating, initialContent)
      : baseCreateValues
  );
  const {
    watch,
    setValue,
    trigger: triggerFieldValidation,
    register,
    reset,
    handleSubmit: submitWithValidation,
    formState: { errors },
  } = form;

  const handleAdvanceQueueItem = React.useCallback(() => {
    dismissTooltips();
    reset(DEFAULT_MEETING_FEEDBACK_FORM_VALUES);
    setStep('attendance');
  }, [dismissTooltips, reset]);

  const handleFinishQueue = React.useCallback(() => {
    dismissTooltips();
    reset(baseCreateValues);
    setStep(resolvedInitialStep);
    setOpen(false);
    onClose?.();
  }, [baseCreateValues, dismissTooltips, onClose, reset, resolvedInitialStep]);

  const {
    queueItems,
    queueIndex,
    isQueueMode,
    activeReservation,
    hasRemainingQueueCard,
    queueMotionState,
    isTransitioningCard,
    prepareOpenSnapshot,
    resetQueueOnClose,
    advanceOrCloseQueue,
  } = useFeedbackQueueMotion({
    open,
    isEditMode,
    reservation,
    queue,
    initialQueueIndex,
    onSkipReservation,
    onAdvanceItem: handleAdvanceQueueItem,
    onFinishQueue: handleFinishQueue,
  });

  const savedRating = activeReservation.feedback?.rating?.rating;
  const savedContent = activeReservation.feedback?.rating?.content;

  const baseFormValues = React.useMemo<MeetingFeedbackFormValues>(
    () =>
      isEditMode
        ? buildEditBaseValues(activeReservation, initialRating, initialContent)
        : baseCreateValues,
    [
      isEditMode,
      activeReservation,
      initialRating,
      initialContent,
      baseCreateValues,
    ]
  );

  // Keep edit form synced with latest saved values whenever dialog is closed
  // so subsequent unlimited edits (#731) always open with up-to-date values.
  React.useEffect(() => {
    if (isEditMode && !open) {
      reset(
        buildEditBaseValues(activeReservation, initialRating, initialContent)
      );
    }
  }, [
    isEditMode,
    open,
    savedRating,
    savedContent,
    activeReservation,
    initialRating,
    initialContent,
    reset,
  ]);

  const meetingHappened = watch('meetingHappened');
  const rating = watch('rating');
  const content = watch('content');
  const notHappenedReason = watch('notHappenedReason');
  const notHappenedNote = watch('notHappenedNote');

  const contentFieldId = React.useId();
  const noteFieldId = React.useId();

  const effectiveStep: MeetingFeedbackStep = isEditMode ? 'rating' : step;

  const { containerRef: surfaceRef, captureCurrentHeight } = useStepHeightMorph(
    `${activeReservation.id}-${effectiveStep}`
  );

  const transitionToStep = React.useCallback(
    (nextStep: MeetingFeedbackStep) => {
      captureCurrentHeight();
      dismissTooltips();
      setStep(nextStep);
    },
    [captureCurrentHeight, dismissTooltips]
  );

  const resetDraftToBase = React.useCallback(() => {
    reset(baseFormValues);
    setStep(resolvedInitialStep);
    dismissTooltips();
  }, [reset, baseFormValues, resolvedInitialStep, dismissTooltips]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && inFlightRef.current) {
      return;
    }

    if (nextOpen) {
      prepareOpenSnapshot();
      if (isEditMode) {
        reset(
          buildEditBaseValues(activeReservation, initialRating, initialContent)
        );
        setStep('rating');
      }
      setOpen(true);
      return;
    }

    // Manual close resets draft cleanly (1.b.3 & #731).
    resetQueueOnClose();
    resetDraftToBase();
    setOpen(false);
    onClose?.();
  };

  const handleCloseOrSkipClick = () => {
    if (inFlightRef.current || isTransitioningCard) return;
    if (isQueueMode) {
      dismissTooltips();
      advanceOrCloseQueue(true);
      return;
    }
    handleOpenChange(false);
  };

  const handleNextFromAttendance = () => {
    if (meetingHappened === true && sourceRole !== 'mentor') {
      transitionToStep('rating');
    } else if (meetingHappened === false) {
      transitionToStep('not-happened');
    }
  };

  const handleValidSubmit = async (
    currentValues: MeetingFeedbackFormValues
  ) => {
    if (inFlightRef.current || isTransitioningCard) return;

    if (isEditMode) {
      const updatePayload = toUpdateFeedbackPayload(currentValues);
      if (!updatePayload || !onUpdateFeedback) return;

      inFlightRef.current = true;
      setIsSubmitting(true);

      try {
        await onUpdateFeedback(updatePayload);
        reset({
          meetingHappened: true,
          rating: updatePayload.rating,
          content: updatePayload.content,
          notHappenedReason: null,
          notHappenedNote: '',
        });
        dismissTooltips();
        setOpen(false);
        onClose?.();
        toast({
          title: '已儲存',
          description: '您的回饋已更新！',
        });
      } catch (err) {
        if (err instanceof ReservationVersionConflictError) {
          resetDraftToBase();
          setOpen(false);
          onClose?.();
          toast({
            variant: 'destructive',
            description: RESERVATION_CONFLICT_MESSAGE,
          });
          return;
        }

        toast({
          variant: 'destructive',
          title: '儲存失敗',
          description: '內容已保留，請再試一次。',
        });
      } finally {
        inFlightRef.current = false;
        setIsSubmitting(false);
      }
      return;
    }

    const payload = toSubmitFeedbackPayload(currentValues, sourceRole);
    if (!payload || !onSubmitFeedback) return;

    inFlightRef.current = true;
    setIsSubmitting(true);

    try {
      await onSubmitFeedback(payload, activeReservation);
      toast({
        title: '已送出',
        description: 'X-Talent 已收到您的回饋，謝謝您！',
      });
      advanceOrCloseQueue(false);
    } catch (err) {
      if (err instanceof ReservationVersionConflictError) {
        resetDraftToBase();
        setOpen(false);
        onClose?.();
        toast({
          variant: 'destructive',
          description: RESERVATION_CONFLICT_MESSAGE,
        });
        return;
      }

      toast({
        variant: 'destructive',
        title: '送出失敗',
        description: '內容已保留，請再試一次。',
      });
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const contentError = errors.content?.message;
  const isOtherReason = notHappenedReason === 'OTHER';
  const noteError = isOtherReason ? errors.notHappenedNote?.message : undefined;

  const canSubmitStep2 =
    effectiveStep === 'rating'
      ? !contentError && content.length <= MAX_FEEDBACK_CONTENT_LENGTH
      : Boolean(
          notHappenedReason &&
          (!isOtherReason ||
            (!noteError &&
              notHappenedNote.length <= MAX_NOT_HAPPENED_NOTE_LENGTH))
        );

  const guardToastOutsideEvent = (event: {
    target: EventTarget | null;
    preventDefault: () => void;
  }) => {
    if (isSubmitting || isTransitioningCard) {
      event.preventDefault();
      return;
    }
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('[data-radix-toast-viewport], [toast-close]')
    ) {
      event.preventDefault();
    }
  };

  const defaultTrigger = isEditMode ? (
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
      填寫回饋
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>

      <DialogPortal>
        <DialogOverlay
          data-testid="feedback-dialog-overlay"
          className="bg-text-primary/20 motion-safe:animate-feedback-overlay-in backdrop-blur-[3px]"
        />

        <DialogContentFrame
          onEscapeKeyDown={(e) => {
            if (isSubmitting || isTransitioningCard) {
              e.preventDefault();
              return;
            }
            if (isMaskTooltipOpen || isSkipTooltipOpen) {
              e.preventDefault();
              dismissTooltips();
            }
          }}
          onPointerDownOutside={guardToastOutsideEvent}
          onInteractOutside={guardToastOutsideEvent}
          className="motion-safe:animate-feedback-dialog-in w-[calc(100%-2rem)] max-w-[468px] gap-0 overflow-visible border-0 bg-transparent p-0 shadow-none sm:rounded-lg"
        >
          {hasRemainingQueueCard ? (
            <div
              aria-hidden="true"
              data-testid="feedback-queue-back-card"
              className="border-background-border bg-background-white pointer-events-none absolute top-1.5 right-1.5 -bottom-1.5 left-1.5 -z-10 rotate-[-5deg] rounded-lg border shadow-sm transition-transform duration-300"
            />
          ) : null}

          <div
            ref={surfaceRef}
            data-testid="feedback-dialog-surface"
            data-queue-motion={queueMotionState}
            className={cn(
              'border-background-border bg-background-white text-text-primary relative flex max-h-[90dvh] flex-col overflow-hidden rounded-lg border shadow-lg sm:max-h-[92dvh]',
              queueMotionState === 'swiping-out' &&
                'motion-safe:animate-feedback-card-out',
              queueMotionState === 'promoting' &&
                'motion-safe:animate-feedback-card-promote'
            )}
          >
            {/* Fixed Top Header: Queue Progress + Mentor Session Info */}
            <div className="relative z-20 shrink-0 px-5 pt-5 sm:px-6 sm:pt-6">
              {isQueueMode ? (
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-text-primary text-base font-semibold">
                        會談回饋
                      </span>
                      <span
                        data-testid="feedback-queue-counter"
                        className="text-text-tertiary text-xs tabular-nums"
                      >
                        第 {queueIndex + 1}／{queueItems.length} 場
                      </span>
                    </div>

                    <Tooltip
                      content="略過這場，下次登入再提醒；也可到歷史紀錄填寫。"
                      side="bottom"
                      align="end"
                      dismissSignal={tooltipDismissSignal}
                      onOpenChange={setIsSkipTooltipOpen}
                      testId="feedback-skip-tooltip"
                      contentClassName="w-60"
                    >
                      <button
                        type="button"
                        aria-label={`略過 ${activeReservation.name} 這場回饋`}
                        disabled={isSubmitting || isTransitioningCard}
                        onClick={handleCloseOrSkipClick}
                        className="text-text-secondary hover:bg-background-bottom hover:text-text-primary focus-visible:ring-brand-500 inline-flex size-7 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </Tooltip>
                  </div>

                  <div
                    role="progressbar"
                    aria-label="會談回饋進度"
                    aria-valuemin={1}
                    aria-valuemax={queueItems.length}
                    aria-valuenow={queueIndex + 1}
                    data-testid="feedback-queue-progressbar"
                    className="mt-3 flex gap-1.5"
                  >
                    {queueItems.map((item, idx) => {
                      const segmentState =
                        idx < queueIndex
                          ? 'completed'
                          : idx === queueIndex
                            ? 'current'
                            : 'upcoming';

                      return (
                        <span
                          key={item.id}
                          data-state={segmentState}
                          data-active={idx <= queueIndex ? 'true' : 'false'}
                          className={cn(
                            'h-1 flex-1 rounded-full transition-colors duration-300',
                            segmentState === 'current'
                              ? 'bg-brand-700'
                              : segmentState === 'completed'
                                ? 'bg-brand-200'
                                : 'bg-background-border'
                          )}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div
                data-testid="feedback-mentor-header"
                className="flex items-center justify-between gap-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="border-avatar-border/50 size-10 shrink-0 border">
                    <AvatarImage
                      src={
                        activeReservation.avatar
                          ? getAvatarThumbUrl(activeReservation.avatar)
                          : undefined
                      }
                      alt={activeReservation.name}
                    />
                    <AvatarFallback className="text-text-primary text-xs font-medium">
                      {getInitials(activeReservation.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0">
                    <p className="text-text-primary truncate text-sm font-semibold">
                      {activeReservation.name}
                    </p>
                    <p className="text-text-secondary truncate text-xs tabular-nums">
                      {activeReservation.date} · {activeReservation.time}
                    </p>
                  </div>
                </div>

                {!isQueueMode ? (
                  <button
                    type="button"
                    aria-label="關閉回饋視窗"
                    disabled={isSubmitting}
                    onClick={handleCloseOrSkipClick}
                    className="text-text-secondary hover:bg-background-bottom hover:text-text-primary focus-visible:ring-brand-500 inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <div className="bg-background-border mt-4 h-px w-full" />
            </div>

            {/* Scrollable Step Body + Sticky Bottom Footer */}
            <form
              onSubmit={submitWithValidation(handleValidSubmit)}
              noValidate
              className="flex min-h-0 flex-1 flex-col"
            >
              <div
                className={cn(
                  'min-h-0 flex-1 overflow-y-auto px-5 sm:px-6',
                  effectiveStep === 'not-happened' ? 'py-3.5' : 'py-4'
                )}
              >
                <div
                  key={`${activeReservation.id}-${effectiveStep}`}
                  className={cn(
                    'motion-safe:animate-feedback-step-in',
                    effectiveStep === 'not-happened' ? 'space-y-3' : 'space-y-4'
                  )}
                >
                  {effectiveStep === 'attendance' ? (
                    <AttendanceStepContent
                      meetingHappened={meetingHappened}
                      disabled={isTransitioningCard}
                      onSelectMeetingHappened={(val) =>
                        setValue('meetingHappened', val, {
                          shouldValidate: true,
                        })
                      }
                    />
                  ) : effectiveStep === 'rating' ? (
                    <RatingStepContent
                      isEditMode={isEditMode}
                      rating={rating}
                      content={content}
                      contentError={contentError}
                      contentFieldId={contentFieldId}
                      isSubmitting={isSubmitting}
                      contentRegistration={register('content')}
                      tooltipDismissSignal={tooltipDismissSignal}
                      onMaskTooltipOpenChange={setIsMaskTooltipOpen}
                      onRatingChange={(nextValue) =>
                        setValue('rating', nextValue, {
                          shouldValidate: true,
                        })
                      }
                    />
                  ) : (
                    <NotHappenedStepContent
                      sourceRole={sourceRole}
                      notHappenedReason={notHappenedReason}
                      notHappenedNote={notHappenedNote}
                      noteError={noteError}
                      noteFieldId={noteFieldId}
                      isSubmitting={isSubmitting}
                      noteRegistration={register('notHappenedNote')}
                      onSelectReason={(reason) => {
                        setValue('notHappenedReason', reason, {
                          shouldValidate: true,
                        });
                        void triggerFieldValidation('notHappenedNote');
                      }}
                    />
                  )}
                </div>
              </div>

              <MeetingFeedbackFooter
                effectiveStep={effectiveStep}
                isEditMode={isEditMode}
                isSubmitting={isSubmitting}
                isTransitioningCard={isTransitioningCard}
                canProceedAttendance={meetingHappened !== null}
                canSubmitStep2={canSubmitStep2}
                submitDirectlyOnAttendance={
                  sourceRole === 'mentor' && meetingHappened === true
                }
                hasRemainingQueueCard={hasRemainingQueueCard}
                onNextFromAttendance={handleNextFromAttendance}
                onBackToAttendance={() => transitionToStep('attendance')}
                onCancelEdit={() => handleOpenChange(false)}
              />
            </form>
          </div>
        </DialogContentFrame>
      </DialogPortal>
    </Dialog>
  );
}
