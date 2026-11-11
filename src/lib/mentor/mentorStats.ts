import type { MentorFeedbackPage } from '@/types/feedback';
import type { MentorStats, RawMentorStats } from '@/types/mentor';

export interface RawMentorStatsCarrier {
  stats?: RawMentorStats | null;
  completed_meeting_count?: number | null;
  total_rating_count?: number | null;
  rating_count?: number | null;
  rating_average?: number | null;
}

export interface MentorDisplayStats {
  completedMeetingCount: number;
  totalRatingCount: number;
  ratingAverage: number | null;
}

function toNonNegativeInt(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

export function normalizeMentorStats(
  raw?: RawMentorStatsCarrier | null
): MentorStats | null {
  if (!raw) return null;

  const source: RawMentorStats | null =
    raw.stats ??
    (raw.completed_meeting_count !== undefined ||
    raw.total_rating_count !== undefined ||
    raw.rating_count !== undefined ||
    raw.rating_average !== undefined
      ? {
          completed_meeting_count: raw.completed_meeting_count,
          total_rating_count: raw.total_rating_count,
          rating_count: raw.rating_count,
          rating_average: raw.rating_average,
        }
      : null);

  if (!source) {
    return null;
  }

  const completedMeetingCount = toNonNegativeInt(
    source.completed_meeting_count
  );
  const rawRatingCount = source.total_rating_count ?? source.rating_count;
  const ratingCount = toNonNegativeInt(rawRatingCount);
  const hasZeroRatingCount =
    rawRatingCount !== undefined &&
    rawRatingCount !== null &&
    ratingCount === 0;
  const rawRatingAverage = source.rating_average;
  const ratingAverage =
    !hasZeroRatingCount &&
    typeof rawRatingAverage === 'number' &&
    Number.isFinite(rawRatingAverage) &&
    rawRatingAverage > 0
      ? rawRatingAverage
      : null;

  return {
    completed_meeting_count: completedMeetingCount,
    rating_count: ratingCount,
    rating_average: ratingAverage,
  };
}

export function formatMentorScoreNumber(
  ratingAverage?: number | null
): string | null {
  if (
    typeof ratingAverage !== 'number' ||
    !Number.isFinite(ratingAverage) ||
    ratingAverage <= 0
  ) {
    return null;
  }
  const rounded = Math.round(ratingAverage * 10) / 10;
  return rounded.toFixed(1);
}

export function formatReviewItemScore(rating: number): string {
  if (!Number.isFinite(rating) || rating <= 0) {
    return '0';
  }
  const rounded = Math.round(rating * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function resolveMentorDisplayStats({
  profileStats,
  feedbackPage,
  hasFeedbackError = false,
}: {
  profileStats?: MentorStats | null;
  feedbackPage?: MentorFeedbackPage | null;
  hasFeedbackError?: boolean;
}): MentorDisplayStats {
  const hasLiveFeedback = Boolean(
    feedbackPage && !feedbackPage.isFallback && !hasFeedbackError
  );

  const totalRatingCount = hasLiveFeedback
    ? feedbackPage!.totalRatingCount
    : (profileStats?.rating_count ?? 0);

  const completedMeetingCount =
    hasLiveFeedback && feedbackPage!.completedMeetingCount !== null
      ? feedbackPage!.completedMeetingCount
      : (profileStats?.completed_meeting_count ?? 0);

  const rawAverage =
    hasLiveFeedback && feedbackPage!.ratingAverage !== null
      ? feedbackPage!.ratingAverage
      : (profileStats?.rating_average ?? null);

  const ratingAverage =
    totalRatingCount > 0 &&
    typeof rawAverage === 'number' &&
    Number.isFinite(rawAverage) &&
    rawAverage > 0
      ? rawAverage
      : null;

  return {
    completedMeetingCount,
    totalRatingCount,
    ratingAverage,
  };
}
