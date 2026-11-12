'use client';

import { ArrowRight, Info, Loader2, X } from 'lucide-react';
import * as React from 'react';

import { FeedbackStarRating } from '@/components/reservation/FeedbackStarRating';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContentFrame,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  DEFAULT_MEETING_FEEDBACK_FORM_VALUES,
  useMeetingFeedbackForm,
} from '@/hooks/user/reservation/useMeetingFeedbackForm';
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
  type MeetingFeedbackFormValues,
  toSubmitFeedbackPayload,
  toUpdateFeedbackPayload,
} from '@/schemas/meetingFeedbackSchema';
import type { Reservation } from '@/types/reservation';
import {
  NOT_HAPPENED_PARTIES,
  NOT_HAPPENED_PARTY_LABELS,
  NOT_HAPPENED_REASON_LABELS,
  NOT_HAPPENED_REASONS,
  type SubmitReservationFeedbackRequest,
  type UpdateReservationFeedbackRequest,
} from '@/types/reservationFeedback';

export type MeetingFeedbackStep = 'attendance' | 'rating' | 'not-happened';
export type MeetingFeedbackMode = 'create' | 'edit';
type QueueMotionState = 'idle' | 'swiping-out' | 'promoting';

const QUEUE_SWIPE_OUT_MS = 260;
const QUEUE_PROMOTE_MS = 360;
const STEP_HEIGHT_MORPH_MS = 340;

export interface MeetingFeedbackDialogProps {
  reservation: Reservation;
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
    notHappenedParty: null,
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

function isReducedMotionPreferred(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function MeetingFeedbackDialog({
  reservation,
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
  trigger,
  className,
}: MeetingFeedbackDialogProps) {
  const isEditMode = mode === 'edit';
  const resolvedInitialStep: MeetingFeedbackStep = isEditMode
    ? 'rating'
    : initialStep;

  const queueItems = React.useMemo(
    () => (!isEditMode && queue && queue.length > 0 ? queue : [reservation]),
    [isEditMode, queue, reservation]
  );
  const isQueueMode = !isEditMode && queueItems.length > 1;

  const [open, setOpen] = React.useState(defaultOpen);
  const [queueIndex, setQueueIndex] = React.useState(() =>
    Math.min(Math.max(0, initialQueueIndex), Math.max(0, queueItems.length - 1))
  );
  const [queueMotionState, setQueueMotionState] =
    React.useState<QueueMotionState>('idle');
  const [step, setStep] =
    React.useState<MeetingFeedbackStep>(resolvedInitialStep);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isMaskTooltipOpen, setIsMaskTooltipOpen] = React.useState(false);
  const [isSkipTooltipOpen, setIsSkipTooltipOpen] = React.useState(false);

  const inFlightRef = React.useRef(false);
  const stepViewportRef = React.useRef<HTMLDivElement | null>(null);
  const prevStepHeightRef = React.useRef<number | null>(null);
  const stepMorphAnimRef = React.useRef<Animation | null>(null);
  const queueTimersRef = React.useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const { toast } = useToast();

  const activeReservation =
    queueItems[Math.min(queueIndex, queueItems.length - 1)] ?? reservation;
  const hasRemainingQueueCard =
    isQueueMode && queueIndex < queueItems.length - 1;

  const savedRating = activeReservation.feedback?.rating?.rating;
  const savedContent = activeReservation.feedback?.rating?.content;

  const baseFormValues = React.useMemo<MeetingFeedbackFormValues>(
    () =>
      isEditMode
        ? buildEditBaseValues(activeReservation, initialRating, initialContent)
        : buildCreateInitialValues(
            resolvedInitialStep,
            initialRating,
            initialContent
          ),
    [
      isEditMode,
      activeReservation,
      resolvedInitialStep,
      initialRating,
      initialContent,
    ]
  );

  const form = useMeetingFeedbackForm(baseFormValues);
  const {
    watch,
    setValue,
    register,
    reset,
    getValues,
    formState: { errors },
  } = form;

  const clearQueueTimers = React.useCallback(() => {
    for (const timer of queueTimersRef.current) {
      clearTimeout(timer);
    }
    queueTimersRef.current = [];
  }, []);

  React.useEffect(() => {
    return () => {
      clearQueueTimers();
      stepMorphAnimRef.current?.cancel();
    };
  }, [clearQueueTimers]);

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
  const notHappenedParty = watch('notHappenedParty');
  const notHappenedReason = watch('notHappenedReason');
  const notHappenedNote = watch('notHappenedNote');

  const contentFieldId = React.useId();
  const noteFieldId = React.useId();
  const maskTooltipId = React.useId();
  const skipTooltipId = React.useId();

  const effectiveStep: MeetingFeedbackStep = isEditMode ? 'rating' : step;

  const transitionToStep = React.useCallback(
    (nextStep: MeetingFeedbackStep) => {
      if (stepViewportRef.current) {
        prevStepHeightRef.current =
          stepViewportRef.current.getBoundingClientRect().height;
      }
      setIsMaskTooltipOpen(false);
      setStep(nextStep);
    },
    []
  );

  React.useLayoutEffect(() => {
    const el = stepViewportRef.current;
    const prevHeight = prevStepHeightRef.current;
    prevStepHeightRef.current = null;

    if (
      !el ||
      prevHeight === null ||
      typeof el.animate !== 'function' ||
      isReducedMotionPreferred()
    ) {
      return;
    }

    const nextHeight = el.getBoundingClientRect().height;
    if (Math.abs(nextHeight - prevHeight) <= 1) {
      return;
    }

    stepMorphAnimRef.current?.cancel();
    const anim = el.animate(
      [
        { height: `${prevHeight}px`, overflow: 'hidden' },
        { height: `${nextHeight}px`, overflow: 'hidden' },
      ],
      {
        duration: STEP_HEIGHT_MORPH_MS,
        easing: 'cubic-bezier(0.22, 0.75, 0.25, 1)',
      }
    );
    stepMorphAnimRef.current = anim;
    anim.onfinish = () => {
      if (stepMorphAnimRef.current === anim) {
        stepMorphAnimRef.current = null;
      }
    };
  }, [effectiveStep]);

  const resetDraftToBase = React.useCallback(() => {
    reset(baseFormValues);
    setStep(resolvedInitialStep);
    setIsMaskTooltipOpen(false);
    setIsSkipTooltipOpen(false);
  }, [reset, baseFormValues, resolvedInitialStep]);

  const advanceOrCloseQueue = React.useCallback(
    (didSkip: boolean) => {
      if (didSkip) {
        onSkipReservation?.(activeReservation);
      }

      if (!isQueueMode || queueIndex >= queueItems.length - 1) {
        clearQueueTimers();
        setQueueMotionState('idle');
        setQueueIndex(0);
        resetDraftToBase();
        setOpen(false);
        return;
      }

      setIsMaskTooltipOpen(false);
      setIsSkipTooltipOpen(false);

      if (isReducedMotionPreferred()) {
        setQueueIndex((prev) => Math.min(prev + 1, queueItems.length - 1));
        reset(DEFAULT_MEETING_FEEDBACK_FORM_VALUES);
        setStep('attendance');
        setQueueMotionState('idle');
        return;
      }

      clearQueueTimers();
      setQueueMotionState('swiping-out');

      const outTimer = setTimeout(() => {
        setQueueIndex((prev) => Math.min(prev + 1, queueItems.length - 1));
        reset(DEFAULT_MEETING_FEEDBACK_FORM_VALUES);
        setStep('attendance');
        setQueueMotionState('promoting');

        const promoteTimer = setTimeout(() => {
          setQueueMotionState('idle');
        }, QUEUE_PROMOTE_MS);
        queueTimersRef.current.push(promoteTimer);
      }, QUEUE_SWIPE_OUT_MS);

      queueTimersRef.current.push(outTimer);
    },
    [
      activeReservation,
      clearQueueTimers,
      isQueueMode,
      onSkipReservation,
      queueIndex,
      queueItems.length,
      reset,
      resetDraftToBase,
    ]
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && inFlightRef.current) {
      return;
    }

    if (nextOpen) {
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
    clearQueueTimers();
    setQueueMotionState('idle');
    setQueueIndex(
      Math.min(
        Math.max(0, initialQueueIndex),
        Math.max(0, queueItems.length - 1)
      )
    );
    resetDraftToBase();
    setOpen(false);
  };

  const handleCloseOrSkipClick = () => {
    if (inFlightRef.current || queueMotionState !== 'idle') return;
    if (isQueueMode) {
      advanceOrCloseQueue(true);
      return;
    }
    handleOpenChange(false);
  };

  const handleNextFromAttendance = () => {
    if (meetingHappened === true) {
      transitionToStep('rating');
    } else if (meetingHappened === false) {
      transitionToStep('not-happened');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inFlightRef.current || queueMotionState !== 'idle') return;

    const currentValues = getValues();

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
          notHappenedParty: null,
          notHappenedReason: null,
          notHappenedNote: '',
        });
        setIsMaskTooltipOpen(false);
        setOpen(false);
        toast({
          title: '已儲存',
          description: '您的回饋已更新！',
        });
      } catch (err) {
        if (err instanceof ReservationVersionConflictError) {
          resetDraftToBase();
          setOpen(false);
          toast({
            variant: 'destructive',
            description: RESERVATION_CONFLICT_MESSAGE,
          });
          return;
        }

        // Keep dialog open with entered rating & content preserved and show red destructive toast.
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

    const payload = toSubmitFeedbackPayload(currentValues);
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
        toast({
          variant: 'destructive',
          description: RESERVATION_CONFLICT_MESSAGE,
        });
        return;
      }

      // Design Hub #730 failure scenario: keep dialog open with all inputs intact
      // and show red destructive toast in top-right viewport.
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
  const noteError = errors.notHappenedNote?.message;
  const hasContentError =
    Boolean(contentError) || content.length > MAX_FEEDBACK_CONTENT_LENGTH;
  const hasNoteError =
    Boolean(noteError) || notHappenedNote.length > MAX_FEEDBACK_CONTENT_LENGTH;

  const isTransitioningCard = queueMotionState !== 'idle';

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
            data-testid="feedback-dialog-surface"
            data-queue-motion={queueMotionState}
            className={cn(
              'border-background-border bg-background-white text-text-primary relative max-h-[88dvh] overflow-y-auto rounded-lg border p-5 shadow-lg sm:p-6',
              queueMotionState === 'swiping-out' &&
                'motion-safe:animate-feedback-card-out',
              queueMotionState === 'promoting' &&
                'motion-safe:animate-feedback-card-promote'
            )}
          >
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

                  <div className="relative inline-flex items-center">
                    <button
                      type="button"
                      aria-label={`略過 ${activeReservation.name} 這場回饋`}
                      aria-describedby={
                        isSkipTooltipOpen ? skipTooltipId : undefined
                      }
                      disabled={isSubmitting || isTransitioningCard}
                      onMouseEnter={() => setIsSkipTooltipOpen(true)}
                      onMouseLeave={() => setIsSkipTooltipOpen(false)}
                      onFocus={() => setIsSkipTooltipOpen(true)}
                      onBlur={() => setIsSkipTooltipOpen(false)}
                      onClick={handleCloseOrSkipClick}
                      className="text-text-secondary hover:bg-background-bottom hover:text-text-primary focus-visible:ring-brand-500 inline-flex size-7 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>

                    {isSkipTooltipOpen ? (
                      <div
                        id={skipTooltipId}
                        role="tooltip"
                        className="bg-text-primary text-text-white pointer-events-none absolute right-0 bottom-full z-20 mb-2 w-60 rounded-md px-3 py-2 text-xs leading-relaxed shadow-md"
                      >
                        略過這場，下次登入再提醒；也可到歷史紀錄填寫。
                      </div>
                    ) : null}
                  </div>
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
                  {queueItems.map((item, idx) => (
                    <span
                      key={item.id}
                      data-active={idx <= queueIndex ? 'true' : 'false'}
                      className={cn(
                        'h-1 flex-1 rounded-full transition-colors duration-300',
                        idx <= queueIndex
                          ? 'bg-brand-700'
                          : 'bg-background-border'
                      )}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {/* Top Mentor Avatar & Session Time Header */}
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

            <div className="bg-background-border my-4 h-px w-full" />

            <form onSubmit={handleSubmit} noValidate>
              <div ref={stepViewportRef}>
                <div
                  key={`${activeReservation.id}-${effectiveStep}`}
                  className="motion-safe:animate-feedback-step-in space-y-4"
                >
                  {effectiveStep === 'attendance' ? (
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
                        ).map((option) => {
                          const isSelected = meetingHappened === option.value;
                          return (
                            <label
                              key={option.label}
                              className={cn(
                                'focus-within:ring-brand-500 flex cursor-pointer items-center gap-2.5 rounded-md border px-3.5 py-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-offset-1',
                                isSelected
                                  ? 'border-text-primary bg-background-white text-text-primary ring-text-primary font-medium ring-1'
                                  : 'border-background-border bg-background-white text-text-primary hover:bg-background-hover'
                              )}
                            >
                              <input
                                type="radio"
                                name="meetingHappened"
                                className="sr-only"
                                checked={isSelected}
                                onChange={() =>
                                  setValue('meetingHappened', option.value, {
                                    shouldValidate: true,
                                  })
                                }
                              />
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                                  isSelected
                                    ? 'border-text-primary border-2'
                                    : 'border-text-tertiary'
                                )}
                              >
                                {isSelected ? (
                                  <span className="bg-text-primary size-2 rounded-full" />
                                ) : null}
                              </span>
                              <span>{option.label}</span>
                            </label>
                          );
                        })}
                      </div>

                      <DialogFooter className="flex flex-row justify-end pt-2 sm:space-x-0">
                        <Button
                          type="button"
                          disabled={
                            meetingHappened === null || isTransitioningCard
                          }
                          onClick={handleNextFromAttendance}
                          className="bg-brand-500 text-text-primary hover:bg-brand-400 rounded-md px-4 disabled:opacity-45"
                        >
                          <span>下一步</span>
                          <ArrowRight
                            className="ml-1.5 size-4"
                            aria-hidden="true"
                          />
                        </Button>
                      </DialogFooter>
                    </>
                  ) : effectiveStep === 'rating' ? (
                    <>
                      <DialogHeader className="space-y-1 text-left">
                        <p className="text-brand-700 text-xs font-medium">
                          {isEditMode
                            ? '已送出回饋 · 不限次數編輯'
                            : '步驟 2 / 2 · 交流回饋'}
                        </p>

                        <div className="flex items-center gap-1.5">
                          <DialogTitle className="text-text-primary text-18 font-semibold">
                            {isEditMode ? '編輯回饋' : '為本次會議評分'}
                          </DialogTitle>

                          <div className="relative inline-flex items-center">
                            <button
                              type="button"
                              aria-label="姓名遮罩說明"
                              aria-expanded={isMaskTooltipOpen}
                              aria-describedby={
                                isMaskTooltipOpen ? maskTooltipId : undefined
                              }
                              onMouseEnter={() => setIsMaskTooltipOpen(true)}
                              onMouseLeave={() => setIsMaskTooltipOpen(false)}
                              onFocus={() => setIsMaskTooltipOpen(true)}
                              onBlur={() => setIsMaskTooltipOpen(false)}
                              onClick={() =>
                                setIsMaskTooltipOpen((prev) => !prev)
                              }
                              className="text-text-secondary hover:bg-background-bottom hover:text-text-primary focus-visible:ring-brand-500 inline-flex size-6 items-center justify-center rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                            >
                              <Info className="size-4" aria-hidden="true" />
                            </button>

                            {isMaskTooltipOpen ? (
                              <div
                                id={maskTooltipId}
                                role="tooltip"
                                data-testid="feedback-name-masking-tooltip"
                                className="bg-text-primary text-text-white pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-60 -translate-x-1/2 rounded-md px-3 py-2 text-xs leading-relaxed shadow-md"
                              >
                                公開評價將以遮罩姓名顯示（例如：王＊明），不會公開您的完整姓名。
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <DialogDescription className="sr-only">
                          請選擇 1 至 10 分並填寫選填文字回饋。
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-2.5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-text-primary text-sm font-medium">
                            評分
                          </span>
                          <span
                            data-testid="meeting-rating-value"
                            className="tabular-nums"
                          >
                            <span className="text-brand-700 text-lg font-semibold">
                              {rating}
                            </span>
                            <span className="text-text-secondary text-xs">
                              {' '}
                              / 10
                            </span>
                          </span>
                        </div>

                        <FeedbackStarRating
                          value={rating}
                          disabled={isSubmitting}
                          ariaLabel="整體滿意度"
                          onChange={(nextValue) => {
                            setValue('rating', nextValue, {
                              shouldValidate: true,
                            });
                          }}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor={contentFieldId}
                          className="text-text-primary block text-sm font-medium"
                        >
                          文字回饋{' '}
                          <span className="text-text-secondary font-normal">
                            （選填）
                          </span>
                        </label>
                        <Textarea
                          id={contentFieldId}
                          placeholder="分享這次交流的收穫，或給導師一些建議⋯"
                          rows={5}
                          aria-invalid={hasContentError}
                          disabled={isSubmitting}
                          className="resize-none overflow-y-auto text-sm font-normal"
                          {...register('content')}
                        />
                        <div className="flex items-center justify-between gap-2 text-xs">
                          {hasContentError ? (
                            <p
                              role="alert"
                              className="text-status-error-default"
                            >
                              {contentError ??
                                `評論內容不可超過 ${MAX_FEEDBACK_CONTENT_LENGTH} 字`}
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

                      <DialogFooter className="flex flex-row items-center justify-between gap-3 pt-1 sm:justify-between sm:space-x-0">
                        {isEditMode ? (
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={isSubmitting}
                            onClick={() => handleOpenChange(false)}
                            className="text-text-secondary hover:bg-background-bottom hover:text-text-primary rounded-md px-2.5"
                          >
                            取消
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={isSubmitting}
                            onClick={() => transitionToStep('attendance')}
                            className="text-text-secondary hover:bg-background-bottom hover:text-text-primary rounded-md px-2.5"
                          >
                            上一步
                          </Button>
                        )}

                        <Button
                          type="submit"
                          disabled={
                            isSubmitting ||
                            isTransitioningCard ||
                            hasContentError
                          }
                          className="bg-brand-500 text-text-primary hover:bg-brand-400 rounded-md px-4"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="mr-1.5 size-4 animate-spin" />
                              {isEditMode ? '儲存中...' : '送出中...'}
                            </>
                          ) : isEditMode ? (
                            '儲存'
                          ) : (
                            '送出回饋'
                          )}
                        </Button>
                      </DialogFooter>
                    </>
                  ) : (
                    <>
                      <DialogHeader className="space-y-1 text-left">
                        <p className="text-brand-700 text-xs font-medium">
                          步驟 2 / 2 · 未進行回報
                        </p>
                        <DialogTitle className="text-text-primary text-18 font-semibold">
                          未進行會談的原因
                        </DialogTitle>
                        <DialogDescription className="text-text-secondary text-sm">
                          請協助說明未進行的對象與原因，不會影響公開評價。
                        </DialogDescription>
                      </DialogHeader>

                      {/* Question 1: Who did not attend */}
                      <div className="space-y-2">
                        <p className="text-text-primary text-sm font-medium">
                          誰沒有進行會談？
                        </p>
                        <div
                          role="radiogroup"
                          aria-label="誰沒有進行會談"
                          className="grid grid-cols-2 gap-2.5"
                        >
                          {NOT_HAPPENED_PARTIES.map((party) => {
                            const isSelected = notHappenedParty === party;
                            return (
                              <label
                                key={party}
                                className={cn(
                                  'focus-within:ring-brand-500 flex cursor-pointer items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-offset-1',
                                  isSelected
                                    ? 'border-text-primary bg-background-white text-text-primary ring-text-primary font-medium ring-1'
                                    : 'border-background-border bg-background-white text-text-primary hover:bg-background-hover'
                                )}
                              >
                                <input
                                  type="radio"
                                  name="notHappenedParty"
                                  value={party}
                                  className="sr-only"
                                  disabled={isSubmitting}
                                  checked={isSelected}
                                  onChange={() =>
                                    setValue('notHappenedParty', party, {
                                      shouldValidate: true,
                                    })
                                  }
                                />
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                                    isSelected
                                      ? 'border-text-primary border-2'
                                      : 'border-text-tertiary'
                                  )}
                                >
                                  {isSelected ? (
                                    <span className="bg-text-primary size-2 rounded-full" />
                                  ) : null}
                                </span>
                                <span>{NOT_HAPPENED_PARTY_LABELS[party]}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Question 2: Why it did not happen */}
                      <div className="space-y-2">
                        <p className="text-text-primary text-sm font-medium">
                          為何沒有成功進行？
                        </p>
                        <div
                          role="radiogroup"
                          aria-label="為何沒有成功進行"
                          className="space-y-2"
                        >
                          {NOT_HAPPENED_REASONS.map((reason) => {
                            const isSelected = notHappenedReason === reason;
                            return (
                              <label
                                key={reason}
                                className={cn(
                                  'focus-within:ring-brand-500 flex cursor-pointer items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-offset-1',
                                  isSelected
                                    ? 'border-text-primary bg-background-white text-text-primary ring-text-primary font-medium ring-1'
                                    : 'border-background-border bg-background-white text-text-primary hover:bg-background-hover'
                                )}
                              >
                                <input
                                  type="radio"
                                  name="notHappenedReason"
                                  value={reason}
                                  className="sr-only"
                                  disabled={isSubmitting}
                                  checked={isSelected}
                                  onChange={() =>
                                    setValue('notHappenedReason', reason, {
                                      shouldValidate: true,
                                    })
                                  }
                                />
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                                    isSelected
                                      ? 'border-text-primary border-2'
                                      : 'border-text-tertiary'
                                  )}
                                >
                                  {isSelected ? (
                                    <span className="bg-text-primary size-2 rounded-full" />
                                  ) : null}
                                </span>
                                <span>
                                  {NOT_HAPPENED_REASON_LABELS[reason]}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Optional supplement note */}
                      <div className="space-y-1.5">
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
                          placeholder={
                            notHappenedReason === 'OTHER'
                              ? '請補充說明其他未進行原因（選填）⋯'
                              : '若有其他想補充的狀況，可在此填寫（選填）⋯'
                          }
                          aria-invalid={hasNoteError}
                          disabled={isSubmitting}
                          className="resize-none overflow-y-auto text-sm font-normal"
                          {...register('notHappenedNote')}
                        />
                        {hasNoteError ? (
                          <p
                            role="alert"
                            className="text-status-error-default text-xs"
                          >
                            {noteError ??
                              `補充說明不可超過 ${MAX_FEEDBACK_CONTENT_LENGTH} 字`}
                          </p>
                        ) : null}
                      </div>

                      <DialogFooter className="flex flex-row items-center justify-between gap-3 pt-1 sm:justify-between sm:space-x-0">
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={isSubmitting}
                          onClick={() => transitionToStep('attendance')}
                          className="text-text-secondary hover:bg-background-bottom hover:text-text-primary rounded-md px-2.5"
                        >
                          上一步
                        </Button>

                        <Button
                          type="submit"
                          disabled={
                            !notHappenedParty ||
                            !notHappenedReason ||
                            isSubmitting ||
                            isTransitioningCard ||
                            hasNoteError
                          }
                          className="bg-brand-500 text-text-primary hover:bg-brand-400 rounded-md px-4"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="mr-1.5 size-4 animate-spin" />
                              送出中...
                            </>
                          ) : (
                            '送出回饋'
                          )}
                        </Button>
                      </DialogFooter>
                    </>
                  )}
                </div>
              </div>
            </form>
          </div>
        </DialogContentFrame>
      </DialogPortal>
    </Dialog>
  );
}
