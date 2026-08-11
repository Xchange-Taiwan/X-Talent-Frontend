import { describe, expect, it } from 'vitest';

import { formatRelativeTime } from './dateUtils';

describe('formatRelativeTime', () => {
  it('correctly calculates relative time', () => {
    const now = new Date();

    // 0 minutes ago (just happened)
    expect(formatRelativeTime(now)).toBe('1 小時');

    // 30 minutes ago (less than 1 hour)
    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);
    expect(formatRelativeTime(thirtyMinsAgo)).toBe('1 小時');

    // 1 hour ago
    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    expect(formatRelativeTime(oneHourAgo)).toBe('1 小時');

    // 23 hours ago
    const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);
    expect(formatRelativeTime(twentyThreeHoursAgo)).toBe('23 小時');

    // 24 hours ago (exactly 1 day)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(oneDayAgo)).toBe('1 天');

    // 30 days ago
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(thirtyDaysAgo)).toBe('30 天');

    // Invalid date
    expect(formatRelativeTime('invalid-date-string')).toBe('');
  });
});
