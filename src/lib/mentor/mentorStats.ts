import dayjs from 'dayjs';

import countriesEnUs from '@/data/countries.en_US.json';
import countriesZhTw from '@/data/countries.zh_TW.json';
import type { MentorStats, RawMentorStats } from '@/types/mentor';

export interface MentorStatsSource {
  stats?: RawMentorStats | null;
  completed_meeting_count?: number | null;
  total_rating_count?: number | null;
  rating_count?: number | null;
  rating_average?: number | null;
}

export function toNonNegativeInt(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

export function normalizeMentorStats(
  raw: MentorStatsSource
): MentorStats | null {
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

export function formatRatingScoreValue(
  ratingAverage: number | null | undefined
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

export interface ExperienceDisplayParts {
  primary: string;
  unit?: string;
}

export function splitExperienceDisplay(
  yearsOfExperience: string | null | undefined
): ExperienceDisplayParts {
  const trimmed = yearsOfExperience?.trim() ?? '';
  if (!trimmed) {
    return { primary: '—' };
  }

  const normalizedRange = trimmed.replace(/~/g, '–');
  const rangeWithYearMatch = normalizedRange.match(/^([\d–+-]+)\s*年$/);
  if (rangeWithYearMatch) {
    return {
      primary: rangeWithYearMatch[1],
      unit: '年',
    };
  }

  const suffixMatch = normalizedRange.match(/^(\d+)\s*(年以上|年以下)$/);
  if (suffixMatch) {
    return {
      primary: suffixMatch[1],
      unit: suffixMatch[2],
    };
  }

  return { primary: normalizedRange };
}

export function resolveLocationLabel(
  rawLocation: string | null | undefined,
  language = 'zh_TW'
): string | undefined {
  const trimmed = rawLocation?.trim();
  if (!trimmed) {
    return undefined;
  }

  const table: Record<string, string> =
    language === 'en_US' ? countriesEnUs : countriesZhTw;
  const upper = trimmed.toUpperCase();
  return table[upper] ?? trimmed;
}

export function getAuthorInitial(
  authorName: string | null | undefined
): string {
  const trimmed = (authorName ?? '').trim();
  if (!trimmed) {
    return '匿';
  }
  const firstMeaningful = Array.from(trimmed).find((ch) => ch !== '*');
  return firstMeaningful ?? '匿';
}

export function formatAuthorMaskedName(
  authorName: string | null | undefined
): string {
  const trimmed = (authorName ?? '').trim();
  return trimmed || '匿名學員';
}

export function toFeedbackTimestampMs(
  createdAt: string | number | null | undefined
): number {
  if (createdAt === null || createdAt === undefined || createdAt === '') {
    return 0;
  }

  if (typeof createdAt === 'number') {
    if (!Number.isFinite(createdAt) || createdAt <= 0) return 0;
    return createdAt < 1e12 ? createdAt * 1000 : createdAt;
  }

  const trimmed = createdAt.trim();
  if (!trimmed) return 0;

  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num <= 0) return 0;
    return num < 1e12 ? num * 1000 : num;
  }

  const normalized = trimmed.replace(/\//g, '-');
  const parsed = dayjs(normalized);
  return parsed.isValid() ? parsed.valueOf() : 0;
}

export function formatFeedbackDate(
  createdAt: string | number | null | undefined
): string {
  const ms = toFeedbackTimestampMs(createdAt);
  if (ms <= 0) {
    return '';
  }
  return dayjs(ms).format('YYYY/MM/DD');
}
