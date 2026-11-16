import { describe, expect, it } from 'vitest';

import {
  formatAuthorMaskedName,
  formatFeedbackDate,
  formatRatingScoreValue,
  getAuthorInitial,
  normalizeMentorStats,
  resolveLocationLabel,
  splitExperienceDisplay,
} from './mentorStats';

describe('mentorStats domain helpers (#736)', () => {
  describe('normalizeMentorStats', () => {
    it('returns null when no stats fields are provided', () => {
      expect(normalizeMentorStats({})).toBeNull();
      expect(normalizeMentorStats({ stats: null })).toBeNull();
    });

    it('prioritizes #760 total_rating_count and falls back to legacy rating_count', () => {
      expect(
        normalizeMentorStats({
          stats: {
            completed_meeting_count: 128,
            total_rating_count: 12,
            rating_count: 3,
            rating_average: 8.5,
          },
        })
      ).toEqual({
        completed_meeting_count: 128,
        rating_count: 12,
        rating_average: 8.5,
      });

      expect(
        normalizeMentorStats({
          completed_meeting_count: 10,
          rating_count: 4,
          rating_average: 9.2,
        })
      ).toEqual({
        completed_meeting_count: 10,
        rating_count: 4,
        rating_average: 9.2,
      });
    });

    it('clears rating_average to null when total_rating_count is explicitly 0', () => {
      expect(
        normalizeMentorStats({
          stats: {
            completed_meeting_count: 5,
            total_rating_count: 0,
            rating_average: 8.5,
          },
        })
      ).toEqual({
        completed_meeting_count: 5,
        rating_count: 0,
        rating_average: null,
      });
    });
  });

  describe('formatRatingScoreValue', () => {
    it('formats positive finite numbers to one decimal place', () => {
      expect(formatRatingScoreValue(8.5)).toBe('8.5');
      expect(formatRatingScoreValue(9)).toBe('9.0');
      expect(formatRatingScoreValue(8.56)).toBe('8.6');
    });

    it('returns null for null, undefined, zero, or non-positive numbers', () => {
      expect(formatRatingScoreValue(null)).toBeNull();
      expect(formatRatingScoreValue(undefined)).toBeNull();
      expect(formatRatingScoreValue(0)).toBeNull();
      expect(formatRatingScoreValue(-1)).toBeNull();
      expect(formatRatingScoreValue(Number.NaN)).toBeNull();
    });
  });

  describe('splitExperienceDisplay', () => {
    it('splits standard seniority labels into primary value and unit', () => {
      expect(splitExperienceDisplay('5~10 年')).toEqual({
        primary: '5–10',
        unit: '年',
      });
      expect(splitExperienceDisplay('10 年以上')).toEqual({
        primary: '10',
        unit: '年以上',
      });
      expect(splitExperienceDisplay('1 年以下')).toEqual({
        primary: '1',
        unit: '年以下',
      });
    });

    it('falls back to dash when empty', () => {
      expect(splitExperienceDisplay('')).toEqual({ primary: '—' });
      expect(splitExperienceDisplay(undefined)).toEqual({ primary: '—' });
    });
  });

  describe('resolveLocationLabel', () => {
    it('maps ISO3 country codes to localized country names', () => {
      expect(resolveLocationLabel('TWN', 'zh_TW')).toBe('台灣');
      expect(resolveLocationLabel('USA', 'zh_TW')).toBe('美國');
      expect(resolveLocationLabel('TWN', 'en_US')).toBe('Taiwan');
    });

    it('passes through already-localized location strings and handles empty values', () => {
      expect(resolveLocationLabel('臺灣', 'zh_TW')).toBe('臺灣');
      expect(resolveLocationLabel('  ', 'zh_TW')).toBeUndefined();
      expect(resolveLocationLabel(null, 'zh_TW')).toBeUndefined();
    });
  });

  describe('author initial & masked name', () => {
    it('extracts first non-asterisk character and handles empty names', () => {
      expect(getAuthorInitial('陳**')).toBe('陳');
      expect(getAuthorInitial('Alex**')).toBe('A');
      expect(getAuthorInitial('***')).toBe('匿');
      expect(getAuthorInitial('')).toBe('匿');
      expect(formatAuthorMaskedName('陳**')).toBe('陳**');
      expect(formatAuthorMaskedName('  ')).toBe('匿名學員');
    });
  });

  describe('formatFeedbackDate', () => {
    it('formats ISO strings, Unix seconds, and Unix milliseconds as YYYY/MM/DD', () => {
      expect(formatFeedbackDate('2026-10-28T08:00:00Z')).toMatch(
        /^2026\/10\/2[89]$/
      );
      expect(formatFeedbackDate(1793184000)).toMatch(/^2026\/10\/\d{2}$/);
      expect(formatFeedbackDate(1793184000000)).toMatch(/^2026\/10\/\d{2}$/);
    });

    it('returns empty string for invalid or missing dates', () => {
      expect(formatFeedbackDate('')).toBe('');
      expect(formatFeedbackDate(null)).toBe('');
      expect(formatFeedbackDate('not-a-date')).toBe('');
    });
  });
});
