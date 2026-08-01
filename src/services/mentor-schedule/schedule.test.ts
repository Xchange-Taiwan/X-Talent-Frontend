import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/apiClient';

import { saveMentorSchedule } from './schedule';

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

  it('includes the UTC year and month required by the schedule API', async () => {
    await saveMentorSchedule({
      userId: '42',
      timeslots: [
        {
          dt_type: 'ALLOW',
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
