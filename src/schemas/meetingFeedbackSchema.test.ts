import { describe, expect, it } from 'vitest';

import {
  canProceedAttendanceStep,
  canSubmitNotHappenedStep,
  canSubmitRatingStep,
  createMeetingFeedbackFormSchema,
  DEFAULT_MEETING_RATING,
  MAX_FEEDBACK_CONTENT_LENGTH,
  MAX_NOT_HAPPENED_NOTE_LENGTH,
  type MeetingFeedbackFormValues,
  MENTOR_NOT_HAPPENED_WARNING_TEXT,
  resolveMeetingFeedbackFooterModel,
  toSubmitFeedbackPayload,
  toUpdateFeedbackPayload,
} from './meetingFeedbackSchema';

const menteeSchema = createMeetingFeedbackFormSchema('mentee');

describe('meetingFeedbackSchema', () => {
  it('defaults rating to 10 and accepts integer values 1 through 10', () => {
    expect(DEFAULT_MEETING_RATING).toBe(10);

    for (let score = 1; score <= 10; score += 1) {
      const parsed = menteeSchema.safeParse({
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
      menteeSchema.safeParse({
        meetingHappened: true,
        rating: 0,
        content: '',
        notHappenedReason: null,
        notHappenedNote: '',
      }).success
    ).toBe(false);

    expect(
      menteeSchema.safeParse({
        meetingHappened: true,
        rating: 11,
        content: '',
        notHappenedReason: null,
        notHappenedNote: '',
      }).success
    ).toBe(false);

    expect(
      menteeSchema.safeParse({
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
      menteeSchema.safeParse({
        meetingHappened: true,
        rating: 10,
        content: 'a'.repeat(MAX_FEEDBACK_CONTENT_LENGTH + 1),
        notHappenedReason: null,
        notHappenedNote: '',
      }).success
    ).toBe(false);

    expect(
      menteeSchema.safeParse({
        meetingHappened: false,
        rating: 10,
        content: '',
        notHappenedReason: 'OTHER',
        notHappenedNote: 'a'.repeat(MAX_NOT_HAPPENED_NOTE_LENGTH),
      }).success
    ).toBe(true);

    const overLimitNoteParsed = menteeSchema.safeParse({
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
    expect(menteeSchema.safeParse(nonOtherWithDraftValues).success).toBe(true);
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

    expect(menteeSchema.safeParse(values).success).toBe(true);
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

  describe('pure step validity helpers', () => {
    it('evaluates attendance step validity via canProceedAttendanceStep', () => {
      expect(canProceedAttendanceStep(null)).toBe(false);
      expect(canProceedAttendanceStep(true)).toBe(true);
      expect(canProceedAttendanceStep(false)).toBe(true);
    });

    it('evaluates rating step validity via canSubmitRatingStep against schema bounds', () => {
      expect(
        canSubmitRatingStep({
          rating: 10,
          content: '',
        })
      ).toBe(true);

      expect(
        canSubmitRatingStep({
          rating: 8,
          content: 'a'.repeat(MAX_FEEDBACK_CONTENT_LENGTH),
        })
      ).toBe(true);

      expect(
        canSubmitRatingStep({
          rating: 8,
          content: 'a'.repeat(MAX_FEEDBACK_CONTENT_LENGTH + 1),
        })
      ).toBe(false);

      expect(
        canSubmitRatingStep({
          rating: 0,
          content: '有效字數但無效分數',
        })
      ).toBe(false);
    });

    it('evaluates not-happened step validity via canSubmitNotHappenedStep including OTHER note rules', () => {
      expect(
        canSubmitNotHappenedStep({
          notHappenedReason: null,
          notHappenedNote: '',
        })
      ).toBe(false);

      expect(
        canSubmitNotHappenedStep({
          notHappenedReason: 'COUNTERPART_ABSENT',
          notHappenedNote: 'a'.repeat(MAX_NOT_HAPPENED_NOTE_LENGTH + 20),
        })
      ).toBe(true);

      expect(
        canSubmitNotHappenedStep({
          notHappenedReason: 'MENTOR_ABSENT',
          notHappenedNote: '',
        })
      ).toBe(true);

      expect(
        canSubmitNotHappenedStep({
          notHappenedReason: 'OTHER',
          notHappenedNote: '',
        })
      ).toBe(true);

      expect(
        canSubmitNotHappenedStep({
          notHappenedReason: 'OTHER',
          notHappenedNote: 'a'.repeat(MAX_NOT_HAPPENED_NOTE_LENGTH),
        })
      ).toBe(true);

      expect(
        canSubmitNotHappenedStep({
          notHappenedReason: 'OTHER',
          notHappenedNote: 'a'.repeat(MAX_NOT_HAPPENED_NOTE_LENGTH + 1),
        })
      ).toBe(false);
    });
  });

  describe('resolveMeetingFeedbackFooterModel', () => {
    const baseValues: MeetingFeedbackFormValues = {
      meetingHappened: null,
      rating: DEFAULT_MEETING_RATING,
      content: '',
      notHappenedReason: null,
      notHappenedNote: '',
    };

    it('resolves Mentee Step 1 attendance footer (disabled until selected, button next-step)', () => {
      const unselected = resolveMeetingFeedbackFooterModel({
        step: 'attendance',
        role: 'mentee',
        values: baseValues,
      });
      expect(unselected.primaryAction).toEqual({
        label: '下一步',
        type: 'button',
        disabled: true,
        actionKind: 'next-step',
        isLoading: false,
      });
      expect(unselected.secondaryAction).toBeNull();

      const selected = resolveMeetingFeedbackFooterModel({
        step: 'attendance',
        role: 'mentee',
        values: { ...baseValues, meetingHappened: true },
      });
      expect(selected.primaryAction).toEqual({
        label: '下一步',
        type: 'button',
        disabled: false,
        actionKind: 'next-step',
        isLoading: false,
      });
      expect(selected.secondaryAction).toBeNull();
    });

    it('resolves Mentor Step 1 attendance footer across null, true (確定送出), and false (下一步)', () => {
      const unselected = resolveMeetingFeedbackFooterModel({
        step: 'attendance',
        role: 'mentor',
        values: baseValues,
      });
      expect(unselected.primaryAction).toEqual({
        label: '確定送出',
        type: 'button',
        disabled: true,
        actionKind: 'submit',
        isLoading: false,
      });
      expect(unselected.secondaryAction).toBeNull();

      const happened = resolveMeetingFeedbackFooterModel({
        step: 'attendance',
        role: 'mentor',
        hasRemainingQueueCard: true,
        values: { ...baseValues, meetingHappened: true },
      });
      expect(happened.primaryAction).toEqual({
        label: '確定送出',
        type: 'submit',
        disabled: false,
        actionKind: 'submit',
        isLoading: false,
      });
      expect(happened.secondaryAction).toBeNull();

      const happenedSubmitting = resolveMeetingFeedbackFooterModel({
        step: 'attendance',
        role: 'mentor',
        isSubmitting: true,
        values: { ...baseValues, meetingHappened: true },
      });
      expect(happenedSubmitting.primaryAction).toEqual({
        label: '送出中...',
        type: 'submit',
        disabled: true,
        actionKind: 'submit',
        isLoading: true,
      });

      const notHappened = resolveMeetingFeedbackFooterModel({
        step: 'attendance',
        role: 'mentor',
        values: { ...baseValues, meetingHappened: false },
      });
      expect(notHappened.primaryAction).toEqual({
        label: '下一步',
        type: 'button',
        disabled: false,
        actionKind: 'next-step',
        isLoading: false,
      });
      expect(notHappened.secondaryAction).toBeNull();
    });

    it('resolves Mentee Step 2 rating footer across single session (送出回饋) and queue mode (送出並填下一場)', () => {
      const single = resolveMeetingFeedbackFooterModel({
        step: 'rating',
        role: 'mentee',
        values: { ...baseValues, meetingHappened: true, rating: 9 },
      });
      expect(single.primaryAction).toEqual({
        label: '送出回饋',
        type: 'submit',
        disabled: false,
        actionKind: 'submit',
        isLoading: false,
      });
      expect(single.secondaryAction).toEqual({
        label: '上一步',
        type: 'button',
        disabled: false,
        actionKind: 'back-to-attendance',
      });

      const queueMiddle = resolveMeetingFeedbackFooterModel({
        step: 'rating',
        role: 'mentee',
        hasRemainingQueueCard: true,
        values: { ...baseValues, meetingHappened: true, rating: 9 },
      });
      expect(queueMiddle.primaryAction.label).toBe('送出並填下一場');

      const overLimit = resolveMeetingFeedbackFooterModel({
        step: 'rating',
        role: 'mentee',
        values: {
          ...baseValues,
          meetingHappened: true,
          content: 'a'.repeat(MAX_FEEDBACK_CONTENT_LENGTH + 1),
        },
      });
      expect(overLimit.primaryAction.disabled).toBe(true);
    });

    it('resolves Step 2 not-happened footer for Mentor (送出 vs 送出並填下一場) and Mentee (送出回饋)', () => {
      const mentorSingle = resolveMeetingFeedbackFooterModel({
        step: 'not-happened',
        role: 'mentor',
        values: {
          ...baseValues,
          meetingHappened: false,
          notHappenedReason: 'COUNTERPART_ABSENT',
        },
      });
      expect(mentorSingle.primaryAction).toEqual({
        label: '送出',
        type: 'submit',
        disabled: false,
        actionKind: 'submit',
        isLoading: false,
      });
      expect(mentorSingle.secondaryAction).toEqual({
        label: '上一步',
        type: 'button',
        disabled: false,
        actionKind: 'back-to-attendance',
      });
      expect(mentorSingle.layoutVariant).toBe('mentor-not-happened');

      const mentorQueue = resolveMeetingFeedbackFooterModel({
        step: 'not-happened',
        role: 'mentor',
        hasRemainingQueueCard: true,
        values: {
          ...baseValues,
          meetingHappened: false,
          notHappenedReason: 'COUNTERPART_ABSENT',
        },
      });
      expect(mentorQueue.primaryAction.label).toBe('送出並填下一場');

      const menteeInvalidOther = resolveMeetingFeedbackFooterModel({
        step: 'not-happened',
        role: 'mentee',
        values: {
          ...baseValues,
          meetingHappened: false,
          notHappenedReason: 'OTHER',
          notHappenedNote: 'a'.repeat(MAX_NOT_HAPPENED_NOTE_LENGTH + 1),
        },
      });
      expect(menteeInvalidOther.primaryAction.label).toBe('送出回饋');
      expect(menteeInvalidOther.primaryAction.disabled).toBe(true);
      expect(menteeInvalidOther.layoutVariant).toBe('mentee-not-happened');
    });

    it('resolves edit mode (#731) footer with 儲存 / 儲存中... and 取消 regardless of step/role/queue props', () => {
      const editIdle = resolveMeetingFeedbackFooterModel({
        mode: 'edit',
        step: 'attendance',
        role: 'mentor',
        hasRemainingQueueCard: true,
        values: {
          ...baseValues,
          meetingHappened: true,
          rating: 8,
          content: '已儲存評價',
        },
      });
      expect(editIdle.primaryAction).toEqual({
        label: '儲存',
        type: 'submit',
        disabled: false,
        actionKind: 'submit',
        isLoading: false,
      });
      expect(editIdle.secondaryAction).toEqual({
        label: '取消',
        type: 'button',
        disabled: false,
        actionKind: 'cancel-edit',
      });
      expect(editIdle.layoutVariant).toBe('rating');

      const editSubmitting = resolveMeetingFeedbackFooterModel({
        mode: 'edit',
        step: 'rating',
        isSubmitting: true,
        values: {
          ...baseValues,
          meetingHappened: true,
          rating: 8,
          content: '已儲存評價',
        },
      });
      expect(editSubmitting.primaryAction).toEqual({
        label: '儲存中...',
        type: 'submit',
        disabled: true,
        actionKind: 'submit',
        isLoading: true,
      });
      expect(editSubmitting.secondaryAction?.disabled).toBe(true);
    });

    it('disables primary action during card transition or external field error', () => {
      const transitioning = resolveMeetingFeedbackFooterModel({
        step: 'rating',
        role: 'mentee',
        isTransitioningCard: true,
        values: { ...baseValues, meetingHappened: true, rating: 10 },
      });
      expect(transitioning.primaryAction.disabled).toBe(true);

      const withFieldError = resolveMeetingFeedbackFooterModel({
        step: 'rating',
        role: 'mentee',
        hasFieldError: true,
        values: { ...baseValues, meetingHappened: true, rating: 10 },
      });
      expect(withFieldError.primaryAction.disabled).toBe(true);
    });
  });
});
