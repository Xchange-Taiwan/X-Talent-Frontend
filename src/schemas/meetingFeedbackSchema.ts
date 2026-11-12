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
  notHappenedParty: z.enum(NOT_HAPPENED_PARTIES).nullable(),
  notHappenedReason: z.enum(NOT_HAPPENED_REASONS).nullable(),
  notHappenedNote: z
    .string()
    .max(
      MAX_FEEDBACK_CONTENT_LENGTH,
      `補充說明不可超過 ${MAX_FEEDBACK_CONTENT_LENGTH} 字`
    ),
});

const happenedBranchSchema = meetingFeedbackFormSchema.pick({
  rating: true,
  content: true,
});

export const updateMeetingFeedbackSchema = happenedBranchSchema;

const notHappenedPartySchema = z.enum(NOT_HAPPENED_PARTIES);
const notHappenedReasonSchema = z.enum(NOT_HAPPENED_REASONS);
const notHappenedNoteSchema = meetingFeedbackFormSchema.shape.notHappenedNote;

export type MeetingFeedbackFormValues = z.infer<
  typeof meetingFeedbackFormSchema
>;

export function toUpdateFeedbackPayload(
  values: Pick<MeetingFeedbackFormValues, 'rating' | 'content'>
): UpdateReservationFeedbackRequest | null {
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
    const partyParsed = notHappenedPartySchema.safeParse(
      values.notHappenedParty
    );
    const reasonParsed = notHappenedReasonSchema.safeParse(
      values.notHappenedReason
    );
    const noteParsed = notHappenedNoteSchema.safeParse(values.notHappenedNote);
    if (!partyParsed.success || !reasonParsed.success || !noteParsed.success) {
      return null;
    }

    const trimmedNote = noteParsed.data.trim();
    return {
      meeting_happened: false,
      not_happened_party: partyParsed.data,
      not_happened_reason: reasonParsed.data,
      ...(trimmedNote.length > 0 ? { not_happened_note: trimmedNote } : {}),
    };
  }

  return null;
}
