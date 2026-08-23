import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient, ApiError } from '@/lib/apiClient';

import {
  fetchMentorSchedule,
  saveMentorSchedule,
  utcYearMonth,
} from './schedule';

vi.mock('@/lib/apiClient', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/apiClient')>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      putUnwrapped: vi.fn(),
      getUnwrapped: vi.fn(),
    },
  };
});

describe('saveMentorSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.putUnwrapped).mockResolvedValue(null);
  });

  it('bubbles up ApiError unmodified', async () => {
    const apiError = new ApiError(400, 'Custom error message');
    vi.mocked(apiClient.putUnwrapped).mockRejectedValueOnce(apiError);

    await expect(
      saveMentorSchedule({
        userId: '42',
        timeslots: [],
      })
    ).rejects.toThrowError(apiError);
  });

  it('bubbles up other errors unmodified', async () => {
    const standardError = new Error('Some other error');
    vi.mocked(apiClient.putUnwrapped).mockRejectedValueOnce(standardError);

    await expect(
      saveMentorSchedule({
        userId: '42',
        timeslots: [],
      })
    ).rejects.toThrowError('Some other error');
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

    expect(apiClient.putUnwrapped).toHaveBeenCalledWith(
      '/v1/mentors/42/schedule',
      {
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
      }
    );
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

describe('fetchMentorSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns schedule data on success', async () => {
    const mockData = { timeslots: [] };
    vi.mocked(apiClient.getUnwrapped).mockResolvedValueOnce(mockData);

    const result = await fetchMentorSchedule({
      userId: '42',
      year: 2025,
      month: 12,
    });

    expect(result).toEqual(mockData);
    expect(apiClient.getUnwrapped).toHaveBeenCalledWith(
      '/v1/mentors/42/schedule/y/2025/m/12',
      { auth: false }
    );
  });

  it('swallows ApiError and returns empty object safely', async () => {
    const apiError = new ApiError(400, 'Custom error message');
    vi.mocked(apiClient.getUnwrapped).mockRejectedValueOnce(apiError);

    const result = await fetchMentorSchedule({
      userId: '42',
      year: 2025,
      month: 12,
    });

    expect(result).toEqual({});
  });

  it('swallows general Error and returns empty object safely', async () => {
    const generalError = new Error('Network error');
    vi.mocked(apiClient.getUnwrapped).mockRejectedValueOnce(generalError);

    const result = await fetchMentorSchedule({
      userId: '42',
      year: 2025,
      month: 12,
    });

    expect(result).toEqual({});
  });
});
