import * as z from 'zod';

import {
  NOT_HAPPENED_PARTIES,
  NOT_HAPPENED_REASONS,
  type SubmitReservationFeedbackRequest,
  type UpdateReservationFeedbackRequest,
} from '@/types/reservationFeedback';

export const DEFAULT_MEETING_RATING = 10;
export const MIN_MEETING_RATING = 1;
export const MAX_MEETING_RATING = 10;
export const MAX_FEEDBACK_CONTENT_LENGTH = 1000;
export const MAX_NOT_HAPPENED_NOTE_LENGTH = 300;

export const FEEDBACK_CONTENT_MAX_ERROR = `評論內容不可超過 ${MAX_FEEDBACK_CONTENT_LENGTH} 字`;
export const NOT_HAPPENED_NOTE_MAX_ERROR = `補充說明不可超過 ${MAX_NOT_HAPPENED_NOTE_LENGTH} 字`;

export function getFeedbackContentError(
  content: string,
  schemaMessage?: string
): string | undefined {
  if (schemaMessage) return schemaMessage;
  return content.length > MAX_FEEDBACK_CONTENT_LENGTH
    ? FEEDBACK_CONTENT_MAX_ERROR
    : undefined;
}

export function getNotHappenedNoteError(
  note: string,
  schemaMessage?: string
): string | undefined {
  if (schemaMessage) return schemaMessage;
  return note.length > MAX_NOT_HAPPENED_NOTE_LENGTH
    ? NOT_HAPPENED_NOTE_MAX_ERROR
    : undefined;
}

export const meetingFeedbackFormSchema = z
  .object({
    meetingHappened: z.boolean().nullable(),
    rating: z
      .number()
      .int('評分須為整數')
      .min(MIN_MEETING_RATING, `評分最低為 ${MIN_MEETING_RATING} 分`)
      .max(MAX_MEETING_RATING, `評分最高為 ${MAX_MEETING_RATING} 分`),
    content: z
      .string()
      .max(MAX_FEEDBACK_CONTENT_LENGTH, FEEDBACK_CONTENT_MAX_ERROR),
    notHappenedParty: z.enum(NOT_HAPPENED_PARTIES).nullable(),
    notHappenedReason: z.enum(NOT_HAPPENED_REASONS).nullable(),
    notHappenedNote: z
      .string()
      .max(MAX_NOT_HAPPENED_NOTE_LENGTH, NOT_HAPPENED_NOTE_MAX_ERROR),
  })
  .superRefine((values, ctx) => {
    if (values.meetingHappened === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['meetingHappened'],
        message: '請選擇本次會談是否順利進行',
      });
      return;
    }

    if (values.meetingHappened === false) {
      if (!values.notHappenedParty) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['notHappenedParty'],
          message: '請選擇誰沒有進行會談',
        });
      }

      if (!values.notHappenedReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['notHappenedReason'],
          message: '請選擇為何沒有成功進行',
        });
      }
    }
  });

export type MeetingFeedbackFormValues = z.infer<
  typeof meetingFeedbackFormSchema
>;

export const updateMeetingFeedbackSchema = z.object({
  rating: z
    .number()
    .int('評分須為整數')
    .min(MIN_MEETING_RATING, `評分最低為 ${MIN_MEETING_RATING} 分`)
    .max(MAX_MEETING_RATING, `評分最高為 ${MAX_MEETING_RATING} 分`),
  content: z
    .string()
    .max(MAX_FEEDBACK_CONTENT_LENGTH, FEEDBACK_CONTENT_MAX_ERROR),
});

export function toUpdateFeedbackPayload(values: {
  rating: number;
  content: string;
}): UpdateReservationFeedbackRequest | null {
  const parsed = updateMeetingFeedbackSchema.safeParse(values);
  if (!parsed.success) {
    return null;
  }

  return {
    rating: parsed.data.rating,
    content: parsed.data.content.trim(),
  };
}

export function toSubmitFeedbackPayload(
  values: MeetingFeedbackFormValues
): SubmitReservationFeedbackRequest | null {
  if (values.meetingHappened === true) {
    const ratingValid =
      Number.isInteger(values.rating) &&
      values.rating >= MIN_MEETING_RATING &&
      values.rating <= MAX_MEETING_RATING;
    if (!ratingValid || values.content.length > MAX_FEEDBACK_CONTENT_LENGTH) {
      return null;
    }
    return {
      meeting_happened: true,
      feedback: {
        rating: values.rating,
        content: values.content.trim(),
      },
    };
  }

  if (
    values.meetingHappened === false &&
    values.notHappenedParty &&
    values.notHappenedReason
  ) {
    if (values.notHappenedNote.length > MAX_NOT_HAPPENED_NOTE_LENGTH) {
      return null;
    }
    const partyParsed = z
      .enum(NOT_HAPPENED_PARTIES)
      .safeParse(values.notHappenedParty);
    const reasonParsed = z
      .enum(NOT_HAPPENED_REASONS)
      .safeParse(values.notHappenedReason);
    if (!partyParsed.success || !reasonParsed.success) {
      return null;
    }

    const trimmedNote = values.notHappenedNote.trim();
    return {
      meeting_happened: false,
      not_happened_party: partyParsed.data,
      not_happened_reason: reasonParsed.data,
      ...(trimmedNote.length > 0 ? { not_happened_note: trimmedNote } : {}),
    };
  }

  return null;
}
