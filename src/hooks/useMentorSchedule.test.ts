import { act, renderHook, waitFor } from '@testing-library/react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/mentor-schedule/sync', () => ({
  loadMonthScheduleCached: vi.fn(),
  loadMonthScheduleFresh: vi.fn(),
  prefetchMonthSchedule: vi.fn(),
  syncMonths: vi.fn(),
}));

import { useMentorSchedule } from '@/hooks/useMentorSchedule';
import { buildDateTime } from '@/lib/profile/scheduleHelpers';
import { loadMonthScheduleCached } from '@/services/mentor-schedule/sync';

const mockLoadMonthScheduleCached = vi.mocked(loadMonthScheduleCached);

describe('useMentorSchedule', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly maps occurrenceId in parsedDraft on load', async () => {
    const mockRaws = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1774390000,
        dtend: 1774391800,
        rrule: undefined,
        exdate: [],
      },
    ];

    mockLoadMonthScheduleCached.mockReturnValue({
      cached: mockRaws,
      revalidate: Promise.resolve(mockRaws),
    });

    const { result } = renderHook(() =>
      useMentorSchedule({
        backend: { userId: '123', year: 2026, month: 7 },
      })
    );

    // Initial load from cache
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.parsedDraft).toHaveLength(1);
    const slot = result.current.parsedDraft[0];
    expect(slot.occurrenceId).toBe('101_1774390000');
    expect(slot.id).toBe(101);
    expect(slot.occurrenceUnix).toBe(1774390000);
  });

  it('correctly updates a draft slot using its occurrenceId', async () => {
    const mockRaws = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1774390000,
        dtend: 1774391800,
        rrule: undefined,
        exdate: [],
      },
    ];

    mockLoadMonthScheduleCached.mockReturnValue({
      cached: mockRaws,
      revalidate: Promise.resolve(mockRaws),
    });

    const { result } = renderHook(() =>
      useMentorSchedule({
        backend: { userId: '123', year: 2026, month: 7 },
      })
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    act(() => {
      const success = result.current.updateDraftSlot('101_1774390000', {
        startTime: '13:00',
        durationMinutes: 45,
      });
      expect(success).toBe(true);
    });

    const baseDate = dayjs(1774390000 * 1000).format('YYYY-MM-DD');
    const expectedTime = buildDateTime(baseDate, '13:00');
    const expectedUnix = Math.floor(expectedTime.valueOf() / 1000);
    const expectedId = `101_${expectedUnix}`;

    expect(result.current.parsedDraft).toHaveLength(1);
    const updatedSlot = result.current.parsedDraft[0];
    expect(updatedSlot.occurrenceId).toBe(expectedId);
    expect(updatedSlot.durationMinutes).toBe(45);
  });

  it('correctly deletes a draft slot using its occurrenceId', async () => {
    const mockRaws = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1774390000,
        dtend: 1774391800,
        rrule: undefined,
        exdate: [],
      },
    ];

    mockLoadMonthScheduleCached.mockReturnValue({
      cached: mockRaws,
      revalidate: Promise.resolve(mockRaws),
    });

    const { result } = renderHook(() =>
      useMentorSchedule({
        backend: { userId: '123', year: 2026, month: 7 },
      })
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.parsedDraft).toHaveLength(1);

    act(() => {
      result.current.deleteDraftSlot('101_1774390000');
    });

    expect(result.current.parsedDraft).toHaveLength(0);
  });
});
