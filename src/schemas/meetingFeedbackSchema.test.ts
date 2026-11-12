import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MEETING_RATING,
  MAX_FEEDBACK_CONTENT_LENGTH,
  meetingFeedbackFormSchema,
  toSubmitFeedbackPayload,
} from './meetingFeedbackSchema';

describe('meetingFeedbackSchema', () => {
  it('defaults rating to 10 and accepts integer values 1 through 10', () => {
    expect(DEFAULT_MEETING_RATING).toBe(10);

    for (let score = 1; score <= 10; score += 1) {
      const parsed = meetingFeedbackFormSchema.safeParse({
        meetingHappened: true,
        rating: score,
        content: '',
        notHappenedReason: null,
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
      }).success
    ).toBe(false);

    expect(
      meetingFeedbackFormSchema.safeParse({
        meetingHappened: true,
        rating: 11,
        content: '',
        notHappenedReason: null,
      }).success
    ).toBe(false);

    expect(
      meetingFeedbackFormSchema.safeParse({
        meetingHappened: true,
        rating: 8.5,
        content: '',
        notHappenedReason: null,
      }).success
    ).toBe(false);
  });

  it('rejects content exceeding MAX_FEEDBACK_CONTENT_LENGTH', () => {
    const parsed = meetingFeedbackFormSchema.safeParse({
      meetingHappened: true,
      rating: 10,
      content: 'a'.repeat(MAX_FEEDBACK_CONTENT_LENGTH + 1),
      notHappenedReason: null,
    });
    expect(parsed.success).toBe(false);
  });

  it('builds meeting_happened=true payload with trimmed content', () => {
    const payload = toSubmitFeedbackPayload({
      meetingHappened: true,
      rating: 9,
      content: '  非常感謝導師的職涯建議！  ',
      notHappenedReason: 'OTHER',
    });

    expect(payload).toEqual({
      meeting_happened: true,
      feedback: {
        rating: 9,
        content: '非常感謝導師的職涯建議！',
      },
    });
  });

  it('builds meeting_happened=false payload with only not_happened_reason and no feedback field', () => {
    const payload = toSubmitFeedbackPayload({
      meetingHappened: false,
      rating: 10,
      content: 'ignored text',
      notHappenedReason: 'MENTOR_ABSENT',
    });

    expect(payload).toEqual({
      meeting_happened: false,
      not_happened_reason: 'MENTOR_ABSENT',
    });
    expect(payload && 'feedback' in payload).toBe(false);
  });

  it('returns null when attendance or not_happened_reason is incomplete', () => {
    expect(
      toSubmitFeedbackPayload({
        meetingHappened: null,
        rating: 10,
        content: '',
        notHappenedReason: null,
      })
    ).toBeNull();

    expect(
      toSubmitFeedbackPayload({
        meetingHappened: false,
        rating: 10,
        content: '',
        notHappenedReason: null,
      })
    ).toBeNull();
  });

  it('ignores over-limit content from the rating step when user switches to meetingHappened=false', () => {
    expect(
      toSubmitFeedbackPayload({
        meetingHappened: false,
        rating: 10,
        content: 'a'.repeat(1005),
        notHappenedReason: 'MENTOR_ABSENT',
      })
    ).toEqual({
      meeting_happened: false,
      not_happened_reason: 'MENTOR_ABSENT',
    });
  });
});
