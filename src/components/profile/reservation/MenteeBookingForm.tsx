'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useBookingForm } from '@/hooks/user/reservation/useBookingForm';
import { trackEvent } from '@/lib/analytics';
import type { BookingSlot } from '@/lib/profile/bookingAvailability';
import { isSlotTaken } from '@/lib/profile/scheduleHelpers';
import { FOCUS_RING_NO_OFFSET_CLASSES } from '@/lib/ui/focusRing';
import { cn } from '@/lib/utils';

import { ScheduleSlotList } from './ScheduleSlotList';

export interface MenteeBookingFormProps {
  mentorId?: number | string;
  myUserId?: string;
  slots: BookingSlot[];
  monthLoaded: boolean;
  selectedSlot: BookingSlot | null;
  setSelectedSlot: (slot: BookingSlot | null) => void;
  selectedDate: string | null;
  isSubmitting?: boolean;
  isAuthenticated: boolean;
  isIdentityResolved?: boolean;
  onMutationSuccess?: () => void | Promise<void>;
}

export function MenteeBookingForm({
  mentorId,
  myUserId,
  slots,
  monthLoaded,
  selectedSlot,
  setSelectedSlot,
  selectedDate,
  isSubmitting: isSubmittingProp,
  isAuthenticated,
  isIdentityResolved = true,
  onMutationSuccess,
}: MenteeBookingFormProps) {
  const normalizedMentorId =
    mentorId !== undefined && String(mentorId).trim() !== ''
      ? String(mentorId).trim()
      : undefined;
  const parsedMentorId =
    normalizedMentorId !== undefined ? Number(normalizedMentorId) : Number.NaN;
  const numericMentorId =
    Number.isSafeInteger(parsedMentorId) && parsedMentorId > 0
      ? parsedMentorId
      : undefined;

  const trackedGateViewKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isIdentityResolved || isAuthenticated) return;
    const dedupKey =
      numericMentorId !== undefined ? String(numericMentorId) : '__unknown__';
    if (trackedGateViewKeyRef.current === dedupKey) return;
    trackedGateViewKeyRef.current = dedupKey;

    trackEvent({
      name: 'auth_gate_triggered',
      feature: 'reservation',
      metadata: {
        gate_feature: 'reservation',
        trigger_type: 'impression',
        ...(numericMentorId !== undefined
          ? { mentor_id: numericMentorId }
          : {}),
      },
    });
  }, [isAuthenticated, isIdentityResolved, numericMentorId]);

  const {
    register,
    onSubmitForm,
    isSubmitting: isFormSubmitting,
    formState: { errors },
  } = useBookingForm({
    loginUserId: myUserId,
    mentorId: numericMentorId ?? normalizedMentorId,
    selectedSlot,
    setSelectedSlot,
    onMutationSuccess,
  });

  const isSubmitting = isSubmittingProp ?? isFormSubmitting;

  const slotList = (
    <ScheduleSlotList
      mode="interactive"
      slots={slots}
      monthLoaded={monthLoaded}
      selectedSlot={selectedSlot}
      onSelectSlot={setSelectedSlot}
      mentorId={normalizedMentorId}
    />
  );

  if (!isAuthenticated) {
    return (
      <div className="flex w-full flex-col gap-4">
        {slotList}
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <p className="text-text-primary text-sm font-medium">
              登入後即可預約導師時段
            </p>
            <Button
              asChild
              variant="default"
              className="w-full rounded-full px-6 py-3"
            >
              <Link
                href="/auth/signin"
                onClick={() => {
                  trackEvent({
                    name: 'reservation_signin_prompt_click',
                    feature: 'reservation',
                    ...(normalizedMentorId
                      ? { metadata: { mentor_id: normalizedMentorId } }
                      : {}),
                  });
                  trackEvent({
                    name: 'auth_gate_triggered',
                    feature: 'reservation',
                    metadata: {
                      gate_feature: 'reservation',
                      trigger_type: 'click_cta',
                      ...(numericMentorId !== undefined
                        ? { mentor_id: numericMentorId }
                        : {}),
                    },
                  });
                }}
              >
                前往登入
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isButtonDisabled =
    isSubmitting ||
    !selectedDate ||
    !selectedSlot ||
    isSlotTaken(selectedSlot) ||
    Object.keys(errors).length > 0;

  return (
    <form onSubmit={onSubmitForm} className="flex w-full flex-col gap-4">
      {slotList}

      <div className="flex w-full flex-col gap-2">
        <label htmlFor="booking-question" className="text-sm font-semibold">
          你想問導師的問題
        </label>
        <Textarea
          id="booking-question"
          data-clarity-mask="true"
          placeholder="請在此輸入你的問題..."
          className={cn(
            'border-background-border h-[156px] w-full rounded-lg',
            FOCUS_RING_NO_OFFSET_CLASSES
          )}
          disabled={isSubmitting}
          {...register('bookingQuestion')}
        />
        {errors.bookingQuestion && (
          <p className="text-status-error-default mt-1 text-sm">
            {errors.bookingQuestion.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        variant="default"
        data-analytics-click="profile_booking_submit_click"
        data-analytics-feature="reservation"
        data-analytics-location="profile_booking_card"
        {...(normalizedMentorId
          ? { 'data-analytics-param-mentor-id': normalizedMentorId }
          : {})}
        className="disabled:bg-background-border disabled:text-text-disable w-full rounded-full px-6 py-3 disabled:opacity-100"
        disabled={isButtonDisabled}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            處理中...
          </>
        ) : (
          '預約時間'
        )}
      </Button>
    </form>
  );
}
