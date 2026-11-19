'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useToast } from '@/components/ui/use-toast';
import {
  type BookingSlot,
  type CreateBookingPort,
  submitMenteeBooking,
} from '@/lib/profile/bookingAvailability';
import { bookingFormSchema, BookingFormValues } from '@/schemas/bookingSchema';
import { createReservation } from '@/services/reservations';

export interface UseBookingFormParams {
  loginUserId?: string | number | null;
  mentorId?: string | number | null;
  selectedSlot?: BookingSlot | null;
  setSelectedSlot?: (slot: BookingSlot | null) => void;
  onMutationSuccess?: () => void | Promise<void>;
  createBooking?: CreateBookingPort;
}

export function useBookingForm(params: UseBookingFormParams = {}) {
  const {
    loginUserId,
    mentorId,
    selectedSlot,
    setSelectedSlot,
    onMutationSuccess,
    createBooking,
  } = params;

  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      bookingQuestion: '',
    },
    mode: 'onChange',
  });
  const { reset, handleSubmit } = form;

  const submitBooking = useCallback(
    async (question?: string): Promise<boolean> => {
      try {
        const result = await submitMenteeBooking({
          menteeUserId: loginUserId,
          mentorUserId: mentorId,
          slot: selectedSlot,
          question,
          createBooking: async (requestParams) => {
            setIsSubmitting(true);
            return (createBooking ?? createReservation)(requestParams);
          },
        });

        if (!result.ok) {
          if (result.reason === 'unauthenticated') {
            router.push('/auth/signin');
            return false;
          }
          if (result.reason === 'slot_conflict') {
            toast({
              title: '預約時間重疊',
              description: '該時段您已有其他預約，請重新選擇其他時段。',
              variant: 'destructive',
            });
            return false;
          }
          if (result.reason === 'api_error') {
            toast({
              title: '預約失敗',
              description: result.message,
              variant: 'destructive',
            });
          }
          return false;
        }

        toast({
          title: '預約已送出，等待導師回復',
          description: '導師接受後預約才會成立，可至「我的預約」追蹤狀態。',
        });

        setSelectedSlot?.(null);
        reset();
        await Promise.resolve(onMutationSuccess?.()).catch(() => undefined);
        return true;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      loginUserId,
      mentorId,
      selectedSlot,
      setSelectedSlot,
      onMutationSuccess,
      createBooking,
      router,
      toast,
      reset,
    ]
  );

  const onSubmitForm = handleSubmit(async (values) => {
    await submitBooking(values.bookingQuestion);
  });

  return {
    ...form,
    isSubmitting,
    submitBooking,
    onSubmitForm,
  };
}
