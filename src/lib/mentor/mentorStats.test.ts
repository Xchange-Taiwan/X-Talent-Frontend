import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it } from 'vitest';

import type { MentorFeedbackPage } from '@/types/feedback';

import {
  formatMentorScoreNumber,
  formatReviewItemScore,
  normalizeMentorStats,
  resolveMentorDisplayStats,
} from './mentorStats';

describe('mentorStats helpers (#736)', () => {
  it('normalizes total_rating_count with fallback to rating_count and clears rating_average when count is 0', () => {
    expect(normalizeMentorStats(null)).toBeNull();
    expect(normalizeMentorStats({})).toBeNull();

    expect(
      normalizeMentorStats({
        stats: {
          completed_meeting_count: 128,
          total_rating_count: 12,
          rating_count: 5,
          rating_average: 8.54,
        },
      })
    ).toEqual({
      completed_meeting_count: 128,
      rating_count: 12,
      rating_average: 8.54,
    });

    expect(
      normalizeMentorStats({
        stats: {
          completed_meeting_count: 0,
          total_rating_count: 0,
          rating_average: 9.0,
        },
      })
    ).toEqual({
      completed_meeting_count: 0,
      rating_count: 0,
      rating_average: null,
    });
  });

  it('formats mentor average and individual review scores cleanly', () => {
    expect(formatMentorScoreNumber(8.5)).toBe('8.5');
    expect(formatMentorScoreNumber(9)).toBe('9.0');
    expect(formatMentorScoreNumber(8.56)).toBe('8.6');
    expect(formatMentorScoreNumber(0)).toBeNull();
    expect(formatMentorScoreNumber(null)).toBeNull();
    expect(formatMentorScoreNumber(Number.NaN)).toBeNull();

    expect(formatReviewItemScore(9)).toBe('9');
    expect(formatReviewItemScore(8.5)).toBe('8.5');
    expect(formatReviewItemScore(0)).toBe('0');
  });

  it('resolves display stats across profileStats and live vs fallback feedback responses', () => {
    // 1. Profile has stats, feedback endpoint returned 404 fallback -> preserve profile stats
    const fallbackFeedback = fromPartial<MentorFeedbackPage>({
      totalRatingCount: 0,
      ratingAverage: null,
      completedMeetingCount: null,
      isFallback: true,
    });
    expect(
      resolveMentorDisplayStats({
        profileStats: {
          completed_meeting_count: 128,
          rating_count: 12,
          rating_average: 8.5,
        },
        feedbackPage: fallbackFeedback,
      })
    ).toEqual({
      completedMeetingCount: 128,
      totalRatingCount: 12,
      ratingAverage: 8.5,
    });

    // 2. Profile lacks stats (pre-deploy SSR), live feedback endpoint provides counts
    const liveFeedback = fromPartial<MentorFeedbackPage>({
      totalRatingCount: 12,
      ratingAverage: 8.5,
      completedMeetingCount: 128,
      isFallback: false,
    });
    expect(
      resolveMentorDisplayStats({
        profileStats: null,
        feedbackPage: liveFeedback,
      })
    ).toEqual({
      completedMeetingCount: 128,
      totalRatingCount: 12,
      ratingAverage: 8.5,
    });

    // 3. Zero reviews ensures ratingAverage is null
    const emptyLiveFeedback = fromPartial<MentorFeedbackPage>({
      totalRatingCount: 0,
      ratingAverage: 9.0,
      completedMeetingCount: 5,
      isFallback: false,
    });
    expect(
      resolveMentorDisplayStats({
        profileStats: null,
        feedbackPage: emptyLiveFeedback,
      })
    ).toEqual({
      completedMeetingCount: 5,
      totalRatingCount: 0,
      ratingAverage: null,
    });

    // 4. Live feedback stats take precedence over stale SSR profileStats, and fall back when null
    expect(
      resolveMentorDisplayStats({
        profileStats: {
          completed_meeting_count: 10,
          rating_count: 1,
          rating_average: 8.0,
        },
        feedbackPage: fromPartial<MentorFeedbackPage>({
          totalRatingCount: 2,
          ratingAverage: 9.0,
          completedMeetingCount: 11,
          isFallback: false,
        }),
      })
    ).toEqual({
      completedMeetingCount: 11,
      totalRatingCount: 2,
      ratingAverage: 9.0,
    });

    expect(
      resolveMentorDisplayStats({
        profileStats: {
          completed_meeting_count: 10,
          rating_count: 2,
          rating_average: 8.5,
        },
        feedbackPage: fromPartial<MentorFeedbackPage>({
          totalRatingCount: 2,
          ratingAverage: null,
          completedMeetingCount: null,
          isFallback: false,
        }),
      })
    ).toEqual({
      completedMeetingCount: 10,
      totalRatingCount: 2,
      ratingAverage: 8.5,
    });
  });
});
