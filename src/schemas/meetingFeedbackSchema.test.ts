import { describe, expect, it } from 'vitest';

import {
  createMeetingFeedbackFormSchema,
  DEFAULT_MEETING_RATING,
  happenedFeedbackFieldsSchema,
  MAX_FEEDBACK_CONTENT_LENGTH,
  MAX_NOT_HAPPENED_NOTE_LENGTH,
  meetingFeedbackFormSchema,
  type MeetingFeedbackFormValues,
  MENTOR_NOT_HAPPENED_WARNING_TEXT,
  notHappenedFeedbackFieldsSchema,
  toSubmitFeedbackPayload,
  toUpdateFeedbackPayload,
  updateMeetingFeedbackSchema,
} from './meetingFeedbackSchema';

describe('meetingFeedbackSchema', () => {
  it('defaults rating to 10 and accepts integer values 1 through 10', () => {
    expect(DEFAULT_MEETING_RATING).toBe(10);
    expect(updateMeetingFeedbackSchema).toBe(happenedFeedbackFieldsSchema);

    for (let score = 1; score <= 10; score += 1) {
      const parsed = meetingFeedbackFormSchema.safeParse({
        meetingHappened: true,
        rating: score,
        content: '',
        notHappenedReason: null,
        notHappenedNote: '',
      });
      expect(parsed.success).toBe(true);
    }
  });

  it('rejects out-of-range or non-integer ratings', () => {
    expect(
      meetingFeedbackFormSchema.safeParse({
        meetingHappened: true,
        rating: 0,
        content: '',
        notHappenedReason: null,
        notHappenedNote: '',
      }).success
    ).toBe(false);

    expect(
      meetingFeedbackFormSchema.safeParse({
        meetingHappened: true,
        rating: 11,
        content: '',
        notHappenedReason: null,
        notHappenedNote: '',
      }).success
    ).toBe(false);

    expect(
      meetingFeedbackFormSchema.safeParse({
        meetingHappened: true,
        rating: 8.5,
        content: '',
        notHappenedReason: null,
        notHappenedNote: '',
      }).success
    ).toBe(false);
  });

  it('enforces 1000-char limit on both content and OTHER notHappenedNote via shared sub-schemas', () => {
    expect(MAX_FEEDBACK_CONTENT_LENGTH).toBe(1000);
    expect(MAX_NOT_HAPPENED_NOTE_LENGTH).toBe(1000);

    expect(
      notHappenedFeedbackFieldsSchema.safeParse({
        notHappenedReason: 'OTHER',
        notHappenedNote: 'a'.repeat(MAX_NOT_HAPPENED_NOTE_LENGTH),
      }).success
    ).toBe(true);

    expect(
      meetingFeedbackFormSchema.safeParse({
        meetingHappened: true,
        rating: 10,
        content: 'a'.repeat(MAX_FEEDBACK_CONTENT_LENGTH + 1),
        notHappenedReason: null,
        notHappenedNote: '',
      }).success
    ).toBe(false);

    expect(
      meetingFeedbackFormSchema.safeParse({
        meetingHappened: false,
        rating: 10,
        content: '',
        notHappenedReason: 'OTHER',
        notHappenedNote: 'a'.repeat(MAX_NOT_HAPPENED_NOTE_LENGTH),
      }).success
    ).toBe(true);

    const overLimitNoteParsed = meetingFeedbackFormSchema.safeParse({
      meetingHappened: false,
      rating: 10,
      content: '',
      notHappenedReason: 'OTHER',
      notHappenedNote: 'a'.repeat(MAX_NOT_HAPPENED_NOTE_LENGTH + 1),
    });
    expect(overLimitNoteParsed.success).toBe(false);

    expect(
      toSubmitFeedbackPayload({
        meetingHappened: false,
        rating: 10,
        content: '',
        notHappenedReason: 'OTHER',
        notHappenedNote: 'a'.repeat(MAX_NOT_HAPPENED_NOTE_LENGTH + 1),
      })
    ).toBeNull();
  });

  it('builds Mentee meeting_happened=true payload with trimmed content', () => {
    const payload = toSubmitFeedbackPayload({
      meetingHappened: true,
      rating: 9,
      content: '  非常感謝導師的職涯建議！  ',
      notHappenedReason: 'OTHER',
      notHappenedNote: 'ignored',
    });

    expect(payload).toEqual({
      meeting_happened: true,
      feedback: {
        rating: 9,
        content: '非常感謝導師的職涯建議！',
      },
    });
  });

  it('builds Mentor Option A meeting_happened=true payload without rating/content (#740)', () => {
    expect(MENTOR_NOT_HAPPENED_WARNING_TEXT).toBe(
      '送出後不能修改。這場會談不會計入已完成場次，學員的評價也不會公開。'
    );

    const mentorSchema = createMeetingFeedbackFormSchema('mentor');
    expect(
      mentorSchema.safeParse({
        meetingHappened: null,
        rating: 10,
        content: '',
        notHappenedReason: null,
        notHappenedNote: '',
      }).success
    ).toBe(false);

    expect(
      mentorSchema.safeParse({
        meetingHappened: true,
        rating: 10,
        content: 'a'.repeat(1005),
        notHappenedReason: null,
        notHappenedNote: '',
      }).success
    ).toBe(true);

    const mentorHappenedPayload = toSubmitFeedbackPayload(
      {
        meetingHappened: true,
        rating: 10,
        content: '',
        notHappenedReason: null,
        notHappenedNote: '',
      },
      'mentor'
    );

    expect(mentorHappenedPayload).toEqual({
      meeting_happened: true,
    });
    expect(mentorHappenedPayload && 'feedback' in mentorHappenedPayload).toBe(
      false
    );
  });

  it('validates Mentor Option A meeting_happened=false with 5 required reasons and 1000-char OTHER note (#740)', () => {
    const mentorSchema = createMeetingFeedbackFormSchema('mentor');

    expect(
      mentorSchema.safeParse({
        meetingHappened: false,
        rating: 10,
        content: '',
        notHappenedReason: null,
        notHappenedNote: '',
      }).success
    ).toBe(false);

    expect(
      mentorSchema.safeParse({
        meetingHappened: false,
        rating: 10,
        content: '',
        notHappenedReason: 'OTHER',
        notHappenedNote: 'a'.repeat(MAX_NOT_HAPPENED_NOTE_LENGTH + 1),
      }).success
    ).toBe(false);

    expect(
      toSubmitFeedbackPayload(
        {
          meetingHappened: false,
          rating: 10,
          content: '',
          notHappenedReason: 'COUNTERPART_ABSENT',
          notHappenedNote: '',
        },
        'mentor'
      )
    ).toEqual({
      meeting_happened: false,
      not_happened_reason: 'COUNTERPART_ABSENT',
    });

    // Normalizes legacy MENTOR_ABSENT / MENTEE_ABSENT into unified COUNTERPART_ABSENT (#760 §4)
    expect(
      toSubmitFeedbackPayload(
        {
          meetingHappened: false,
          rating: 10,
          content: '',
          notHappenedReason: 'MENTOR_ABSENT',
          notHappenedNote: '',
        },
        'mentor'
      )
    ).toEqual({
      meeting_happened: false,
      not_happened_reason: 'COUNTERPART_ABSENT',
    });

    expect(
      toSubmitFeedbackPayload(
        {
          meetingHappened: false,
          rating: 10,
          content: '',
          notHappenedReason: 'MENTEE_ABSENT',
          notHappenedNote: '',
        },
        'mentee'
      )
    ).toEqual({
      meeting_happened: false,
      not_happened_reason: 'COUNTERPART_ABSENT',
    });

    expect(
      toSubmitFeedbackPayload(
        {
          meetingHappened: false,
          rating: 10,
          content: '',
          notHappenedReason: 'OTHER',
          notHappenedNote: '  學員臨時有事改期  ',
        },
        'mentor'
      )
    ).toEqual({
      meeting_happened: false,
      not_happened_reason: 'OTHER',
      note: '學員臨時有事改期',
    });
  });

  it('builds meeting_happened=false payload with reason only (no not_happened_party) and attaches trimmed note exclusively for OTHER', () => {
    const withoutNote = toSubmitFeedbackPayload({
      meetingHappened: false,
      rating: 10,
      content: 'ignored text',
      notHappenedReason: 'COUNTERPART_ABSENT',
      notHappenedNote: '   ',
    });

    expect(withoutNote).toEqual({
      meeting_happened: false,
      not_happened_reason: 'COUNTERPART_ABSENT',
    });
    expect(withoutNote && 'feedback' in withoutNote).toBe(false);
    expect(withoutNote && 'not_happened_party' in withoutNote).toBe(false);

    const withOtherNote = toSubmitFeedbackPayload({
      meetingHappened: false,
      rating: 10,
      content: '',
      notHappenedReason: 'OTHER',
      notHappenedNote: '  臨時身體不適已私訊說明  ',
    });

    expect(withOtherNote).toEqual({
      meeting_happened: false,
      not_happened_reason: 'OTHER',
      note: '臨時身體不適已私訊說明',
    });
    expect(withOtherNote && 'not_happened_note' in withOtherNote).toBe(false);

    // Draft note entered under OTHER must not block or leak into non-OTHER payload
    const nonOtherWithDraftValues: MeetingFeedbackFormValues = {
      meetingHappened: false,
      rating: 10,
      content: '',
      notHappenedReason: 'SCHEDULE_CONFLICT',
      notHappenedNote: 'a'.repeat(MAX_NOT_HAPPENED_NOTE_LENGTH + 5),
    };
    expect(
      meetingFeedbackFormSchema.safeParse(nonOtherWithDraftValues).success
    ).toBe(true);
    expect(toSubmitFeedbackPayload(nonOtherWithDraftValues)).toEqual({
      meeting_happened: false,
      not_happened_reason: 'SCHEDULE_CONFLICT',
    });
  });

  it('returns null when attendance or reason is incomplete', () => {
    expect(
      toSubmitFeedbackPayload({
        meetingHappened: null,
        rating: 10,
        content: '',
        notHappenedReason: null,
        notHappenedNote: '',
      })
    ).toBeNull();

    expect(
      toSubmitFeedbackPayload({
        meetingHappened: false,
        rating: 10,
        content: '',
        notHappenedReason: null,
        notHappenedNote: '',
      })
    ).toBeNull();
  });

  it('ignores over-limit content from the rating step when user switches to meetingHappened=false', () => {
    const values: MeetingFeedbackFormValues = {
      meetingHappened: false,
      rating: 10,
      content: 'a'.repeat(1005),
      notHappenedReason: 'COUNTERPART_ABSENT',
      notHappenedNote: '',
    };

    expect(meetingFeedbackFormSchema.safeParse(values).success).toBe(true);
    expect(toSubmitFeedbackPayload(values)).toEqual({
      meeting_happened: false,
      not_happened_reason: 'COUNTERPART_ABSENT',
    });
  });

  it('builds PUT edit payload with only { rating, content } and trimmed content (#731)', () => {
    const payload = toUpdateFeedbackPayload({
      rating: 7,
      content: '  更新後的評價內容  ',
    });

    expect(payload).toEqual({
      rating: 7,
      content: '更新後的評價內容',
    });
    expect(Object.keys(payload ?? {})).toEqual(['rating', 'content']);
  });

  it('returns null in toUpdateFeedbackPayload when rating or content is invalid (#731)', () => {
    expect(
      toUpdateFeedbackPayload({
        rating: 0,
        content: '無效評分',
      })
    ).toBeNull();

    expect(
      toUpdateFeedbackPayload({
        rating: 8,
        content: 'a'.repeat(MAX_FEEDBACK_CONTENT_LENGTH + 1),
      })
    ).toBeNull();
  });
});
