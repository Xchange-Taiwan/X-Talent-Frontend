import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MEETING_RATING,
  MAX_FEEDBACK_CONTENT_LENGTH,
  meetingFeedbackFormSchema,
  toSubmitFeedbackPayload,
  toUpdateFeedbackPayload,
} from './meetingFeedbackSchema';

describe('meetingFeedbackSchema', () => {
  it('defaults rating to 10 and accepts integer values 1 through 10', () => {
    expect(DEFAULT_MEETING_RATING).toBe(10);

    for (let score = 1; score <= 10; score += 1) {
      const parsed = meetingFeedbackFormSchema.safeParse({
        meetingHappened: true,
        rating: score,
        content: '',
        notHappenedParty: null,
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
        notHappenedParty: null,
        notHappenedReason: null,
        notHappenedNote: '',
      }).success
    ).toBe(false);

    expect(
      meetingFeedbackFormSchema.safeParse({
        meetingHappened: true,
        rating: 11,
        content: '',
        notHappenedParty: null,
        notHappenedReason: null,
        notHappenedNote: '',
      }).success
    ).toBe(false);

    expect(
      meetingFeedbackFormSchema.safeParse({
        meetingHappened: true,
        rating: 8.5,
        content: '',
        notHappenedParty: null,
        notHappenedReason: null,
        notHappenedNote: '',
      }).success
    ).toBe(false);
  });

  it('rejects content or notHappenedNote exceeding MAX_FEEDBACK_CONTENT_LENGTH', () => {
    expect(
      meetingFeedbackFormSchema.safeParse({
        meetingHappened: true,
        rating: 10,
        content: 'a'.repeat(MAX_FEEDBACK_CONTENT_LENGTH + 1),
        notHappenedParty: null,
        notHappenedReason: null,
        notHappenedNote: '',
      }).success
    ).toBe(false);

    expect(
      meetingFeedbackFormSchema.safeParse({
        meetingHappened: false,
        rating: 10,
        content: '',
        notHappenedParty: 'MENTOR',
        notHappenedReason: 'OTHER',
        notHappenedNote: 'a'.repeat(MAX_FEEDBACK_CONTENT_LENGTH + 1),
      }).success
    ).toBe(false);
  });

  it('builds meeting_happened=true payload with trimmed content', () => {
    const payload = toSubmitFeedbackPayload({
      meetingHappened: true,
      rating: 9,
      content: '  非常感謝導師的職涯建議！  ',
      notHappenedParty: 'MENTOR',
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

  it('builds meeting_happened=false payload with party, reason, optional trimmed note, and no feedback field', () => {
    const withoutNote = toSubmitFeedbackPayload({
      meetingHappened: false,
      rating: 10,
      content: 'ignored text',
      notHappenedParty: 'MENTOR',
      notHappenedReason: 'MENTOR_ABSENT',
      notHappenedNote: '   ',
    });

    expect(withoutNote).toEqual({
      meeting_happened: false,
      not_happened_party: 'MENTOR',
      not_happened_reason: 'MENTOR_ABSENT',
    });
    expect(withoutNote && 'feedback' in withoutNote).toBe(false);

    const withNote = toSubmitFeedbackPayload({
      meetingHappened: false,
      rating: 10,
      content: '',
      notHappenedParty: 'MENTEE',
      notHappenedReason: 'OTHER',
      notHappenedNote: '  臨時身體不適已私訊說明  ',
    });

    expect(withNote).toEqual({
      meeting_happened: false,
      not_happened_party: 'MENTEE',
      not_happened_reason: 'OTHER',
      not_happened_note: '臨時身體不適已私訊說明',
    });
  });

  it('returns null when attendance, party, or reason is incomplete', () => {
    expect(
      toSubmitFeedbackPayload({
        meetingHappened: null,
        rating: 10,
        content: '',
        notHappenedParty: null,
        notHappenedReason: null,
        notHappenedNote: '',
      })
    ).toBeNull();

    expect(
      toSubmitFeedbackPayload({
        meetingHappened: false,
        rating: 10,
        content: '',
        notHappenedParty: null,
        notHappenedReason: 'MENTOR_ABSENT',
        notHappenedNote: '',
      })
    ).toBeNull();

    expect(
      toSubmitFeedbackPayload({
        meetingHappened: false,
        rating: 10,
        content: '',
        notHappenedParty: 'MENTOR',
        notHappenedReason: null,
        notHappenedNote: '',
      })
    ).toBeNull();
  });

  it('ignores over-limit content from the rating step when user switches to meetingHappened=false', () => {
    expect(
      toSubmitFeedbackPayload({
        meetingHappened: false,
        rating: 10,
        content: 'a'.repeat(1005),
        notHappenedParty: 'MENTOR',
        notHappenedReason: 'MENTOR_ABSENT',
        notHappenedNote: '',
      })
    ).toEqual({
      meeting_happened: false,
      not_happened_party: 'MENTOR',
      not_happened_reason: 'MENTOR_ABSENT',
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
