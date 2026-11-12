import * as z from 'zod';

import {
  NOT_HAPPENED_REASONS,
  type SubmitReservationFeedbackRequest,
} from '@/types/reservationFeedback';

export const DEFAULT_MEETING_RATING = 10;
export const MIN_MEETING_RATING = 1;
export const MAX_MEETING_RATING = 10;
export const MAX_FEEDBACK_CONTENT_LENGTH = 1000;

export const meetingFeedbackFormSchema = z.object({
  meetingHappened: z.boolean().nullable(),
  rating: z
    .number()
    .int('評分須為整數')
    .min(MIN_MEETING_RATING, '評分最低為 1 分')
    .max(MAX_MEETING_RATING, '評分最高為 10 分'),
  content: z
    .string()
    .max(
      MAX_FEEDBACK_CONTENT_LENGTH,
      `評論內容不可超過 ${MAX_FEEDBACK_CONTENT_LENGTH} 字`
    ),
  notHappenedReason: z.enum(NOT_HAPPENED_REASONS).nullable(),
});

const happenedBranchSchema = meetingFeedbackFormSchema.pick({
  rating: true,
  content: true,
});

const notHappenedReasonSchema = z.enum(NOT_HAPPENED_REASONS);

export type MeetingFeedbackFormValues = z.infer<
  typeof meetingFeedbackFormSchema
>;

export function toSubmitFeedbackPayload(
  values: MeetingFeedbackFormValues
): SubmitReservationFeedbackRequest | null {
  if (values.meetingHappened === true) {
    const parsed = happenedBranchSchema.safeParse(values);
    if (!parsed.success) {
      return null;
    }
    return {
      meeting_happened: true,
      feedback: {
        rating: parsed.data.rating,
        content: parsed.data.content.trim(),
      },
    };
  }

  if (values.meetingHappened === false) {
    const reasonParsed = notHappenedReasonSchema.safeParse(
      values.notHappenedReason
    );
    if (!reasonParsed.success) {
      return null;
    }
    return {
      meeting_happened: false,
      not_happened_reason: reasonParsed.data,
    };
  }

  return null;
}
