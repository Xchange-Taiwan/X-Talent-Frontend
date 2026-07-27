import * as z from 'zod';

export const bookingFormSchema = z.object({
  bookingQuestion: z.string().trim().min(1, '請輸入你想問導師的問題'),
});

export type BookingFormValues = z.infer<typeof bookingFormSchema>;
