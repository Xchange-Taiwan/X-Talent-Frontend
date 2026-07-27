import * as z from 'zod';

export const bookingFormSchema = z.object({
  bookingQuestion: z.string().trim().max(1000, '問題字數請勿超過 1000 字'),
});

export type BookingFormValues = z.infer<typeof bookingFormSchema>;
