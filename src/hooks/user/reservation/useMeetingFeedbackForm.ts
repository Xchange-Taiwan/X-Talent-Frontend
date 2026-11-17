'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { useToast } from '@/components/ui/use-toast';
import {
  RESERVATION_CONFLICT_MESSAGE,
  ReservationVersionConflictError,
} from '@/lib/reservation/reservationConflictError';
import {
  resolveEffectiveFeedbackRole,
  resolveFeedbackDialogStep,
  resolveFeedbackInitialStep,
} from '@/lib/reservation/reservationLifecyclePolicy';
import {
  createMeetingFeedbackFormSchema,
  DEFAULT_MEETING_RATING,
  type MeetingFeedbackFormValues,
  type MeetingFeedbackMode,
  type MeetingFeedbackStep,
  resolveMeetingFeedbackFooterModel,
  toSubmitFeedbackPayload,
  toUpdateFeedbackPayload,
} from '@/schemas/meetingFeedbackSchema';
import type { Reservation } from '@/types/reservation';
import type {
  FeedbackViewerRole,
  NotHappenedReason,
  SubmitReservationFeedbackRequest,
  UpdateReservationFeedbackRequest,
} from '@/types/reservationFeedback';

import { useFeedbackQueueMotion } from './useFeedbackQueueMotion';
import { useStepHeightMorph } from './useStepHeightMorph';

export const DEFAULT_MEETING_FEEDBACK_FORM_VALUES: MeetingFeedbackFormValues = {
  meetingHappened: null,
  rating: DEFAULT_MEETING_RATING,
  content: '',
  notHappenedReason: null,
  notHappenedNote: '',
};

export function buildEditBaseValues(
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

export function buildCreateInitialValues(
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

export function useMeetingFeedbackForm(
  defaultValues: MeetingFeedbackFormValues = DEFAULT_MEETING_FEEDBACK_FORM_VALUES,
  role: FeedbackViewerRole = 'mentee'
) {
  const schema = React.useMemo(
    () => createMeetingFeedbackFormSchema(role),
    [role]
  );

  return useForm<MeetingFeedbackFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onChange',
  });
}

export interface UseMeetingFeedbackControllerOptions {
  reservation: Reservation;
  queue?: Reservation[];
  initialQueueIndex?: number;
  viewerRole?: FeedbackViewerRole;
  mode?: MeetingFeedbackMode;
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
}

export function useMeetingFeedbackController({
  reservation,
  queue,
  initialQueueIndex = 0,
  viewerRole,
  mode = 'create',
  defaultOpen = false,
  initialStep,
  initialRating,
  initialContent,
  onSubmitFeedback,
  onUpdateFeedback,
  onSkipReservation,
  onClose,
}: UseMeetingFeedbackControllerOptions) {
  const isEditMode = mode === 'edit';

  const [open, setOpen] = React.useState(defaultOpen);
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
    skipRemainingQueue,
    advanceOrCloseQueue,
  } = useFeedbackQueueMotion({
    open,
    isEditMode,
    reservation,
    queue,
    initialQueueIndex,
    onSkipReservation,
  });

  const effectiveViewerRole: FeedbackViewerRole = resolveEffectiveFeedbackRole({
    reservation: activeReservation,
    explicitRole: viewerRole,
    isEditMode,
  });
  const isMentor = !isEditMode && effectiveViewerRole === 'mentor';

  const resolvedInitialStep: MeetingFeedbackStep = resolveFeedbackDialogStep({
    reservation: activeReservation,
    role: effectiveViewerRole,
    mode,
    requestedStep: initialStep,
  });

  const [step, setStep] =
    React.useState<MeetingFeedbackStep>(resolvedInitialStep);

  const baseCreateValues = React.useMemo(
    () =>
      buildCreateInitialValues(
        resolvedInitialStep,
        initialRating,
        initialContent
      ),
    [resolvedInitialStep, initialRating, initialContent]
  );

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

  const form = useMeetingFeedbackForm(baseFormValues, effectiveViewerRole);
  const {
    watch,
    setValue,
    trigger: triggerFieldValidation,
    register,
    reset,
    handleSubmit: submitWithValidation,
    formState: { errors },
  } = form;

  const savedRating = activeReservation.feedback?.rating?.rating;
  const savedContent = activeReservation.feedback?.rating?.content;

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

  const handlePromoteNextItem = React.useCallback(
    (nextReservation: Reservation) => {
      const nextRole = resolveEffectiveFeedbackRole({
        reservation: nextReservation,
        explicitRole: viewerRole,
        isEditMode: false,
      });
      const nextStep = resolveFeedbackInitialStep({
        reservation: nextReservation,
        role: nextRole,
        mode: 'create',
      });
      dismissTooltips();
      reset(
        nextStep === 'attendance'
          ? DEFAULT_MEETING_FEEDBACK_FORM_VALUES
          : buildCreateInitialValues(nextStep)
      );
      setStep(nextStep);
    },
    [dismissTooltips, reset, viewerRole]
  );

  const handleFinishQueue = React.useCallback(() => {
    dismissTooltips();
    reset(baseCreateValues);
    setStep(resolvedInitialStep);
    setOpen(false);
    onClose?.();
  }, [baseCreateValues, dismissTooltips, onClose, reset, resolvedInitialStep]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && (inFlightRef.current || isTransitioningCard)) {
        return;
      }

      if (nextOpen) {
        prepareOpenSnapshot();
        if (isEditMode) {
          reset(
            buildEditBaseValues(
              activeReservation,
              initialRating,
              initialContent
            )
          );
          setStep('rating');
        }
        setOpen(true);
        return;
      }

      // Mark any remaining unaddressed reservation(s) in the active queue as skipped
      // before resetting state and invoking onClose (`dismissQueue`).
      skipRemainingQueue();
      resetQueueOnClose();
      resetDraftToBase();
      setOpen(false);
      onClose?.();
    },
    [
      activeReservation,
      initialContent,
      initialRating,
      isEditMode,
      isTransitioningCard,
      onClose,
      prepareOpenSnapshot,
      reset,
      resetDraftToBase,
      resetQueueOnClose,
      skipRemainingQueue,
    ]
  );

  const handleCloseOrSkipClick = React.useCallback(() => {
    if (inFlightRef.current || isTransitioningCard) return;
    if (isQueueMode) {
      dismissTooltips();
      advanceOrCloseQueue({
        didSkip: true,
        onPromoteNextItem: handlePromoteNextItem,
        onFinishQueue: handleFinishQueue,
      });
      return;
    }
    handleOpenChange(false);
  }, [
    advanceOrCloseQueue,
    dismissTooltips,
    handleFinishQueue,
    handleOpenChange,
    handlePromoteNextItem,
    isQueueMode,
    isTransitioningCard,
  ]);

  const handleNextFromAttendance = React.useCallback(() => {
    if (meetingHappened === true && !isMentor) {
      transitionToStep('rating');
    } else if (meetingHappened === false) {
      transitionToStep('not-happened');
    }
  }, [isMentor, meetingHappened, transitionToStep]);

  const handleBackToAttendance = React.useCallback(() => {
    transitionToStep('attendance');
  }, [transitionToStep]);

  const handleCancelEdit = React.useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  const handleSelectMeetingHappened = React.useCallback(
    (value: boolean) => {
      setValue('meetingHappened', value, { shouldValidate: true });
    },
    [setValue]
  );

  const handleRatingChange = React.useCallback(
    (nextValue: number) => {
      setValue('rating', nextValue, { shouldValidate: true });
    },
    [setValue]
  );

  const handleSelectNotHappenedReason = React.useCallback(
    (reason: NotHappenedReason) => {
      setValue('notHappenedReason', reason, { shouldValidate: true });
      void triggerFieldValidation('notHappenedNote');
    },
    [setValue, triggerFieldValidation]
  );

  const handleValidSubmit = React.useCallback(
    async (currentValues: MeetingFeedbackFormValues) => {
      if (isTransitioningCard) return;

      const executeMutation = isEditMode
        ? (() => {
            const updatePayload = toUpdateFeedbackPayload(currentValues);
            if (!updatePayload || !onUpdateFeedback) return null;
            return async () => {
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
            };
          })()
        : (() => {
            const payload = toSubmitFeedbackPayload(
              currentValues,
              effectiveViewerRole
            );
            if (!payload || !onSubmitFeedback) return null;
            return async () => {
              await onSubmitFeedback(payload, activeReservation);
              toast({
                title: '已送出',
                description: 'X-Talent 已收到您的回饋，謝謝您！',
              });
              advanceOrCloseQueue({
                didSkip: false,
                onPromoteNextItem: handlePromoteNextItem,
                onFinishQueue: handleFinishQueue,
              });
            };
          })();

      if (!executeMutation) return;

      setIsSubmitting(true);
      try {
        await executeMutation();
      } catch (err) {
        if (err instanceof ReservationVersionConflictError) {
          resetQueueOnClose();
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
          title: isEditMode ? '儲存失敗' : '送出失敗',
          description: '內容已保留，請再試一次。',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      activeReservation,
      advanceOrCloseQueue,
      dismissTooltips,
      effectiveViewerRole,
      handleFinishQueue,
      handlePromoteNextItem,
      isEditMode,
      isTransitioningCard,
      onClose,
      onSubmitFeedback,
      onUpdateFeedback,
      reset,
      resetDraftToBase,
      resetQueueOnClose,
      toast,
    ]
  );

  const rawSubmit = React.useMemo(
    () => submitWithValidation(handleValidSubmit),
    [handleValidSubmit, submitWithValidation]
  );

  const handleFormSubmit = React.useCallback(
    async (event?: React.BaseSyntheticEvent) => {
      if (inFlightRef.current || isTransitioningCard) {
        event?.preventDefault();
        return;
      }
      inFlightRef.current = true;
      try {
        await rawSubmit(event);
      } finally {
        inFlightRef.current = false;
      }
    },
    [isTransitioningCard, rawSubmit]
  );

  const contentError = errors.content?.message;
  const isOtherReason = notHappenedReason === 'OTHER';
  const noteError = isOtherReason ? errors.notHappenedNote?.message : undefined;
  const hasFieldError =
    effectiveStep === 'rating' ? Boolean(contentError) : Boolean(noteError);

  const footerModel = resolveMeetingFeedbackFooterModel({
    step: effectiveStep,
    mode,
    role: effectiveViewerRole,
    values: {
      meetingHappened,
      rating,
      content,
      notHappenedReason,
      notHappenedNote,
    },
    hasRemainingQueueCard,
    isSubmitting,
    isTransitioningCard,
    hasFieldError,
  });

  const handleEscapeKeyDown = React.useCallback(
    (event: { preventDefault: () => void }) => {
      if (isSubmitting || isTransitioningCard) {
        event.preventDefault();
        return;
      }
      if (isMaskTooltipOpen || isSkipTooltipOpen) {
        event.preventDefault();
        dismissTooltips();
      }
    },
    [
      dismissTooltips,
      isMaskTooltipOpen,
      isSkipTooltipOpen,
      isSubmitting,
      isTransitioningCard,
    ]
  );

  const guardOutsideInteraction = React.useCallback(
    (event: { target: EventTarget | null; preventDefault: () => void }) => {
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
    },
    [isSubmitting, isTransitioningCard]
  );

  return {
    open,
    isEditMode,
    isMentor,
    effectiveViewerRole,
    effectiveStep,
    isSubmitting,
    surfaceRef,
    queueItems,
    queueIndex,
    isQueueMode,
    activeReservation,
    hasRemainingQueueCard,
    queueMotionState,
    isTransitioningCard,
    form,
    register,
    values: {
      meetingHappened,
      rating,
      content,
      notHappenedReason,
      notHappenedNote,
    },
    contentError,
    noteError,
    footerModel,
    tooltipDismissSignal,
    setIsMaskTooltipOpen,
    setIsSkipTooltipOpen,
    handleOpenChange,
    handleCloseOrSkipClick,
    handleNextFromAttendance,
    handleBackToAttendance,
    handleCancelEdit,
    handleSelectMeetingHappened,
    handleRatingChange,
    handleSelectNotHappenedReason,
    handleFormSubmit,
    handleEscapeKeyDown,
    guardOutsideInteraction,
  };
}
