'use client';

import { Loader2 } from 'lucide-react';
import * as React from 'react';

import { FeedbackStarRating } from '@/components/reservation/FeedbackStarRating';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  DEFAULT_MEETING_FEEDBACK_FORM_VALUES,
  useMeetingFeedbackForm,
} from '@/hooks/user/reservation/useMeetingFeedbackForm';
import {
  RESERVATION_CONFLICT_MESSAGE,
  ReservationVersionConflictError,
} from '@/lib/reservation/reservationConflictError';
import { cn } from '@/lib/utils';
import {
  MAX_FEEDBACK_CONTENT_LENGTH,
  toSubmitFeedbackPayload,
} from '@/schemas/meetingFeedbackSchema';
import type { Reservation } from '@/types/reservation';
import {
  NOT_HAPPENED_REASON_LABELS,
  NOT_HAPPENED_REASONS,
  type SubmitReservationFeedbackRequest,
} from '@/types/reservationFeedback';

export type MeetingFeedbackStep = 'attendance' | 'rating' | 'not-happened';

export interface MeetingFeedbackDialogProps {
  reservation: Reservation;
  disabled?: boolean;
  defaultOpen?: boolean;
  initialStep?: MeetingFeedbackStep;
  onSubmitFeedback: (
    payload: SubmitReservationFeedbackRequest
  ) => Promise<void>;
  className?: string;
}

export default function MeetingFeedbackDialog({
  reservation,
  disabled = false,
  defaultOpen = false,
  initialStep = 'attendance',
  onSubmitFeedback,
  className,
}: MeetingFeedbackDialogProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [step, setStep] = React.useState<MeetingFeedbackStep>(initialStep);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const inFlightRef = React.useRef(false);
  const contentFieldId = React.useId();

  const { toast, dismiss } = useToast();
  const {
    register,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useMeetingFeedbackForm();

  const meetingHappened = watch('meetingHappened');
  const rating = watch('rating');
  const content = watch('content');
  const notHappenedReason = watch('notHappenedReason');

  const resetDraft = React.useCallback(() => {
    reset(DEFAULT_MEETING_FEEDBACK_FORM_VALUES);
    setStep(initialStep);
  }, [initialStep, reset]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSubmitting || inFlightRef.current) return;
    if (!nextOpen) {
      resetDraft();
    }
    setOpen(nextOpen);
  };

  const handleNextStep = () => {
    if (meetingHappened === true) {
      setStep('rating');
    } else if (meetingHappened === false) {
      setStep('not-happened');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inFlightRef.current || isSubmitting) return;

    const payload = toSubmitFeedbackPayload({
      meetingHappened,
      rating,
      content,
      notHappenedReason,
    });
    if (!payload) return;

    inFlightRef.current = true;
    setIsSubmitting(true);

    try {
      await onSubmitFeedback(payload);
      resetDraft();
      setOpen(false);
      toast({
        title: '已送出',
        description: 'X-Talent 已收到您的回饋，謝謝您！',
      });
    } catch (err) {
      if (err instanceof ReservationVersionConflictError) {
        resetDraft();
        setOpen(false);
        toast({
          variant: 'destructive',
          description: RESERVATION_CONFLICT_MESSAGE,
        });
      } else {
        // Close dialog via setOpen(false) directly (bypassing handleOpenChange)
        // so step & form values stay intact for reopening from the failure toast.
        setOpen(false);
        const toastHandle = toast({
          variant: 'destructive',
          description: (
            <span>
              送出失敗，回到
              <button
                type="button"
                onClick={() => {
                  toastHandle?.dismiss?.();
                  dismiss?.();
                  setOpen(true);
                }}
                className="mx-1 font-semibold underline underline-offset-4 hover:opacity-80"
              >
                評論
              </button>
              重新送出
            </span>
          ),
        });
      }
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const isContentOverLimit = content.length > MAX_FEEDBACK_CONTENT_LENGTH;
  const hasContentError = Boolean(errors.content) || isContentOverLimit;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          disabled={disabled || isSubmitting}
          className={cn(
            'h-8 rounded-lg px-3.5 text-xs font-medium sm:h-9 sm:text-sm',
            className
          )}
        >
          填寫回饋
        </Button>
      </DialogTrigger>

      <DialogContent
        className="w-full max-w-[92vw] rounded-2xl p-6 sm:max-w-[440px]"
        onInteractOutside={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {step === 'attendance' ? (
            <>
              <DialogHeader className="space-y-1.5 text-left">
                <DialogTitle className="text-text-primary text-xl font-semibold">
                  會談是否有進行？
                </DialogTitle>
                <DialogDescription className="text-text-secondary text-sm">
                  請選擇本次會談的狀態（{reservation.name} · {reservation.date}
                  ）
                </DialogDescription>
              </DialogHeader>

              <div
                role="radiogroup"
                aria-label="會談是否有進行"
                className="grid grid-cols-2 gap-3"
              >
                {(
                  [
                    { label: '是', value: true },
                    { label: '否', value: false },
                  ] as const
                ).map((option) => {
                  const isSelected = meetingHappened === option.value;
                  return (
                    <label
                      key={option.label}
                      className={cn(
                        'focus-within:ring-brand-500 flex cursor-pointer items-center justify-center gap-2.5 rounded-xl border px-4 py-3.5 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-offset-2',
                        isSelected
                          ? 'border-brand-500 bg-brand-50 text-text-primary'
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
                            ? 'border-brand-600'
                            : 'border-text-tertiary'
                        )}
                      >
                        {isSelected ? (
                          <span className="bg-brand-600 size-2 rounded-full" />
                        ) : null}
                      </span>
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>

              <DialogFooter className="pt-1 sm:justify-stretch">
                <Button
                  type="button"
                  className="w-full"
                  disabled={meetingHappened === null}
                  onClick={handleNextStep}
                >
                  下一步
                </Button>
              </DialogFooter>
            </>
          ) : step === 'rating' ? (
            <>
              <DialogHeader className="space-y-1.5 text-left">
                <DialogTitle className="text-text-primary text-xl font-semibold">
                  為本次會談評分
                </DialogTitle>
                <DialogDescription className="text-text-secondary text-sm">
                  您的回饋能幫助我們持續改善
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <p
                  data-testid="feedback-name-masking-hint"
                  className="bg-background-bottom text-text-secondary rounded-xl px-3.5 py-2.5 text-xs leading-relaxed"
                >
                  公開評價將以遮罩姓名顯示（例如：王**），不會公開您的完整姓名。
                </p>

                <div className="space-y-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-text-primary text-sm font-medium">
                      整體滿意度
                    </span>
                    <span
                      data-testid="meeting-rating-value"
                      className="text-brand-700 text-sm font-semibold tabular-nums"
                    >
                      {rating}{' '}
                      <span className="text-text-tertiary text-xs font-normal">
                        / 10
                      </span>
                    </span>
                  </div>

                  <FeedbackStarRating
                    value={rating}
                    onChange={(nextRating) =>
                      setValue('rating', nextRating, { shouldValidate: true })
                    }
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor={contentFieldId}
                    className="text-text-primary block text-sm font-medium"
                  >
                    評論內容（選填）
                  </label>
                  <Textarea
                    id={contentFieldId}
                    placeholder="分享您對本次會談的想法⋯"
                    rows={5}
                    aria-invalid={hasContentError}
                    disabled={isSubmitting}
                    className="resize-none overflow-y-auto"
                    {...register('content')}
                  />
                  <div className="flex items-center justify-between gap-2 text-xs">
                    {errors.content?.message ? (
                      <p role="alert" className="text-status-error-default">
                        {errors.content.message}
                      </p>
                    ) : (
                      <span />
                    )}
                    <span
                      data-testid="feedback-content-counter"
                      className={cn(
                        'ml-auto tabular-nums',
                        hasContentError
                          ? 'text-status-error-default font-medium'
                          : 'text-text-tertiary'
                      )}
                    >
                      {content.length} / {MAX_FEEDBACK_CONTENT_LENGTH}
                    </span>
                  </div>
                </div>
              </div>

              <DialogFooter className="grid grid-cols-2 gap-3 pt-1 sm:space-x-0">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => setStep('attendance')}
                >
                  上一步
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || hasContentError}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      送出中...
                    </>
                  ) : (
                    '送出'
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader className="space-y-1.5 text-left">
                <DialogTitle className="text-text-primary text-xl font-semibold">
                  未進行會談的原因
                </DialogTitle>
                <DialogDescription className="text-text-secondary text-sm">
                  為何沒有成功進行？
                </DialogDescription>
              </DialogHeader>

              <div
                role="radiogroup"
                aria-label="為何沒有成功進行"
                className="space-y-2.5"
              >
                {NOT_HAPPENED_REASONS.map((reason) => {
                  const isSelected = notHappenedReason === reason;
                  return (
                    <label
                      key={reason}
                      className={cn(
                        'focus-within:ring-brand-500 flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-offset-2',
                        isSelected
                          ? 'border-brand-500 bg-brand-50 text-text-primary font-medium'
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
                            ? 'border-brand-600'
                            : 'border-text-tertiary'
                        )}
                      >
                        {isSelected ? (
                          <span className="bg-brand-600 size-2 rounded-full" />
                        ) : null}
                      </span>
                      <span>{NOT_HAPPENED_REASON_LABELS[reason]}</span>
                    </label>
                  );
                })}
              </div>

              <DialogFooter className="grid grid-cols-2 gap-3 pt-1 sm:space-x-0">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => setStep('attendance')}
                >
                  上一步
                </Button>
                <Button
                  type="submit"
                  disabled={!notHappenedReason || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      送出中...
                    </>
                  ) : (
                    '送出'
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
