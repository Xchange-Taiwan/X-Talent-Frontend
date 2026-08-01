import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/apiClient';

import { saveMentorSchedule, utcYearMonth } from './schedule';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    put: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

describe('saveMentorSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.put).mockResolvedValue({ code: '0', msg: 'ok' });
  });

  it('derives the API-required UTC year and month from dtstart', async () => {
    await saveMentorSchedule({
      userId: '42',
      timeslots: [
        {
          dt_type: 'ALLOW',
          dt_year: 2025,
          dt_month: 12,
          dtstart: 1767226200, // 2026-01-01T00:10:00Z
          dtend: 1767229800,
          exdate: [],
          timezone: 'UTC',
          user_id: 42,
        },
      ],
    });

    expect(apiClient.put).toHaveBeenCalledWith('/v1/mentors/42/schedule', {
      timeslots: [
        {
          user_id: 42,
          dt_type: 'ALLOW',
          dt_year: 2026,
          dt_month: 1,
          dtstart: 1767226200,
          dtend: 1767229800,
          timezone: 'UTC',
          exdate: [],
        },
      ],
    });
  });
});

describe('utcYearMonth', () => {
  it('correctly maps various unix timestamps to UTC year and month', () => {
    // 2026-01-01T00:10:00Z
    expect(utcYearMonth(1767226200)).toEqual({ year: 2026, month: 1 });

    // Boundary: 2026-12-31T23:59:59Z
    expect(utcYearMonth(1798761599)).toEqual({ year: 2026, month: 12 });

    // Boundary: 2027-01-01T00:00:00Z
    expect(utcYearMonth(1798761600)).toEqual({ year: 2027, month: 1 });
  });
});
