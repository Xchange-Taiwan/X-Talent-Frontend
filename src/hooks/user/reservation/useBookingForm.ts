'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { bookingFormSchema, BookingFormValues } from '@/schemas/bookingSchema';

export function useBookingForm() {
  return useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      bookingQuestion: '',
    },
    mode: 'onChange',
  });
}
