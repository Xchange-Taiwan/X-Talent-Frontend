import * as z from 'zod';

import {
  type FeedbackViewerRole,
  type LegacyNotHappenedReason,
  normalizeNotHappenedReason,
  NOT_HAPPENED_REASONS,
  resolveNotHappenedReasonForRole,
  type SubmitReservationFeedbackRequest,
  type UpdateReservationFeedbackRequest,
} from '@/types/reservationFeedback';

export const DEFAULT_MEETING_RATING = 10;
export const MIN_MEETING_RATING = 1;
export const MAX_MEETING_RATING = 10;
export const MAX_FEEDBACK_CONTENT_LENGTH = 1000;
export const MAX_NOT_HAPPENED_NOTE_LENGTH = 1000;

export const FEEDBACK_CONTENT_MAX_ERROR = `評論內容不可超過 ${MAX_FEEDBACK_CONTENT_LENGTH} 字`;
export const NOT_HAPPENED_NOTE_MAX_ERROR = `補充說明不可超過 ${MAX_NOT_HAPPENED_NOTE_LENGTH} 字`;
export const MENTOR_NOT_HAPPENED_WARNING_TEXT =
  '送出後不能修改。這場會談不會計入已完成場次，學員的評價也不會公開。';

export const meetingRatingFieldSchema = z
  .number()
  .int('評分須為整數')
  .min(MIN_MEETING_RATING, `評分最低為 ${MIN_MEETING_RATING} 分`)
  .max(MAX_MEETING_RATING, `評分最高為 ${MAX_MEETING_RATING} 分`);

export const feedbackContentFieldSchema = z
  .string()
  .max(MAX_FEEDBACK_CONTENT_LENGTH, FEEDBACK_CONTENT_MAX_ERROR);

export const notHappenedNoteFieldSchema = z
  .string()
  .max(MAX_NOT_HAPPENED_NOTE_LENGTH, NOT_HAPPENED_NOTE_MAX_ERROR);

export const notHappenedReasonFieldSchema = z.enum(NOT_HAPPENED_REASONS);

export const happenedFeedbackFieldsSchema = z.object({
  rating: meetingRatingFieldSchema,
  content: feedbackContentFieldSchema,
});

export const notHappenedFeedbackFieldsSchema = z
  .object({
    notHappenedReason: notHappenedReasonFieldSchema,
    notHappenedNote: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.notHappenedReason === 'OTHER') {
      const noteResult = notHappenedNoteFieldSchema.safeParse(
        values.notHappenedNote
      );
      if (!noteResult.success) {
        for (const issue of noteResult.error.issues) {
          ctx.addIssue({
            ...issue,
            path: ['notHappenedNote'],
          });
        }
      }
    }
  });

export const updateMeetingFeedbackSchema = happenedFeedbackFieldsSchema;

const meetingFeedbackFormBaseSchema = z.object({
  meetingHappened: z.boolean().nullable(),
  rating: meetingRatingFieldSchema,
  content: z.string(),
  notHappenedReason: notHappenedReasonFieldSchema.nullable(),
  notHappenedNote: z.string(),
});

export function createMeetingFeedbackFormSchema(
  role: FeedbackViewerRole = 'mentee'
) {
  return meetingFeedbackFormBaseSchema.superRefine((values, ctx) => {
    if (values.meetingHappened === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['meetingHappened'],
        message: '請選擇本次會談是否順利進行',
      });
      return;
    }

    if (values.meetingHappened === true) {
      if (role === 'mentor') {
        return;
      }

      const contentResult = feedbackContentFieldSchema.safeParse(
        values.content
      );
      if (!contentResult.success) {
        for (const issue of contentResult.error.issues) {
          ctx.addIssue({
            ...issue,
            path: ['content'],
          });
        }
      }
      return;
    }

    if (!values.notHappenedReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['notHappenedReason'],
        message: '請選擇為何沒有成功進行',
      });
      return;
    }

    if (values.notHappenedReason === 'OTHER') {
      const noteResult = notHappenedNoteFieldSchema.safeParse(
        values.notHappenedNote
      );
      if (!noteResult.success) {
        for (const issue of noteResult.error.issues) {
          ctx.addIssue({
            ...issue,
            path: ['notHappenedNote'],
          });
        }
      }
    }
  });
}

export const meetingFeedbackFormSchema =
  createMeetingFeedbackFormSchema('mentee');

export type MeetingFeedbackFormValues = z.infer<
  typeof meetingFeedbackFormBaseSchema
>;

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

export type MeetingFeedbackPayloadInput = Omit<
  MeetingFeedbackFormValues,
  'notHappenedReason'
> & {
  notHappenedReason: LegacyNotHappenedReason | null;
};

export function toSubmitFeedbackPayload(
  values: MeetingFeedbackPayloadInput,
  role: FeedbackViewerRole = 'mentee'
): SubmitReservationFeedbackRequest | null {
  if (values.meetingHappened === true) {
    if (role === 'mentor') {
      return {
        meeting_happened: true,
      };
    }

    const parsed = happenedFeedbackFieldsSchema.safeParse({
      rating: values.rating,
      content: values.content,
    });
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
    const normalizedReason = values.notHappenedReason
      ? normalizeNotHappenedReason(values.notHappenedReason)
      : null;
    const parsed = notHappenedFeedbackFieldsSchema.safeParse({
      notHappenedReason: normalizedReason,
      notHappenedNote: values.notHappenedNote,
    });
    if (!parsed.success) {
      return null;
    }

    const trimmedNote =
      parsed.data.notHappenedReason === 'OTHER'
        ? parsed.data.notHappenedNote.trim()
        : '';

    return {
      meeting_happened: false,
      not_happened_reason: resolveNotHappenedReasonForRole(
        parsed.data.notHappenedReason,
        role
      ),
      ...(trimmedNote.length > 0 ? { note: trimmedNote } : {}),
    };
  }

  return null;
}
