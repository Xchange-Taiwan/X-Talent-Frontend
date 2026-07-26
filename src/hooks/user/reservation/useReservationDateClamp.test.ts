import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useReservationDateClamp } from './useReservationDateClamp';

describe('useReservationDateClamp', () => {
  const systemDate = new Date('2026-07-26T12:00:00');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(systemDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handleScheduleMonthChange should change year/month and update selectedDate to 1st of month if future', () => {
    const setSelectedDate = vi.fn();
    const setYear = vi.fn();
    const setMonth = vi.fn();

    const { result } = renderHook(() =>
      useReservationDateClamp({
        selectedDate: '2026-07-26',
        setSelectedDate,
        year: 2026,
        setYear,
        month: 7,
        setMonth,
        openReservationDialog: false,
      })
    );

    act(() => {
      // Navigate to August 2026
      result.current.handleScheduleMonthChange(new Date('2026-08-01T00:00:00'));
    });

    expect(setYear).toHaveBeenCalledWith(2026);
    expect(setMonth).toHaveBeenCalledWith(8);
    expect(setSelectedDate).toHaveBeenCalledWith('2026-08-01');
  });

  it('handleScheduleMonthChange should clamp selectedDate to today if navigating to a past month', () => {
    const setSelectedDate = vi.fn();
    const setYear = vi.fn();
    const setMonth = vi.fn();

    const { result } = renderHook(() =>
      useReservationDateClamp({
        selectedDate: '2026-07-26',
        setSelectedDate,
        year: 2026,
        setYear,
        month: 7,
        setMonth,
        openReservationDialog: false,
      })
    );

    act(() => {
      // Navigate to June 2026 (past)
      result.current.handleScheduleMonthChange(new Date('2026-06-01T00:00:00'));
    });

    expect(setYear).toHaveBeenCalledWith(2026);
    expect(setMonth).toHaveBeenCalledWith(6);
    // Since June 1st is before July 26th, it clamps to July 26th (today)
    expect(setSelectedDate).toHaveBeenCalledWith('2026-07-26');
  });

  it('handleScheduleMonthChange should not update selectedDate if openReservationDialog is true', () => {
    const setSelectedDate = vi.fn();
    const setYear = vi.fn();
    const setMonth = vi.fn();

    const { result } = renderHook(() =>
      useReservationDateClamp({
        selectedDate: '2026-07-26',
        setSelectedDate,
        year: 2026,
        setYear,
        month: 7,
        setMonth,
        openReservationDialog: true,
      })
    );

    act(() => {
      result.current.handleScheduleMonthChange(new Date('2026-08-01T00:00:00'));
    });

    expect(setYear).toHaveBeenCalledWith(2026);
    expect(setMonth).toHaveBeenCalledWith(8);
    expect(setSelectedDate).not.toHaveBeenCalled();
  });

  it('clampSelectedDateToToday should do nothing if selectedDate is in the future', () => {
    const setSelectedDate = vi.fn();
    const setYear = vi.fn();
    const setMonth = vi.fn();

    const { result } = renderHook(() =>
      useReservationDateClamp({
        selectedDate: '2026-08-01',
        setSelectedDate,
        year: 2026,
        setYear,
        month: 8,
        setMonth,
        openReservationDialog: false,
      })
    );

    act(() => {
      result.current.clampSelectedDateToToday();
    });

    expect(setSelectedDate).not.toHaveBeenCalled();
    expect(setYear).not.toHaveBeenCalled();
    expect(setMonth).not.toHaveBeenCalled();
  });

  it('clampSelectedDateToToday should snap selectedDate to today and update year/month if selectedDate is in the past', () => {
    const setSelectedDate = vi.fn();
    const setYear = vi.fn();
    const setMonth = vi.fn();

    const { result } = renderHook(() =>
      useReservationDateClamp({
        selectedDate: '2026-06-15',
        setSelectedDate,
        year: 2026,
        setYear,
        month: 6,
        setMonth,
        openReservationDialog: false,
      })
    );

    act(() => {
      result.current.clampSelectedDateToToday();
    });

    expect(setSelectedDate).toHaveBeenCalledWith('2026-07-26');
    expect(setYear).toHaveBeenCalledWith(2026);
    expect(setMonth).toHaveBeenCalledWith(7);
  });
});
