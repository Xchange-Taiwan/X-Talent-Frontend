import { describe, expect, it } from 'vitest';

import { computeReservationTimeInfo } from './useReservationTimeStatus';

const SECOND = 1;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const NOW_MS = 1_700_000_000_000;
const NOW_S = NOW_MS / 1000;

describe('computeReservationTimeInfo', () => {
  it('returns ended when now >= dtend', () => {
    expect(
      computeReservationTimeInfo(NOW_S - HOUR, NOW_S - MINUTE, NOW_MS)
    ).toEqual({ status: 'ended', label: '已結束' });
  });

  it('returns ended at the exact dtend boundary', () => {
    expect(computeReservationTimeInfo(NOW_S - HOUR, NOW_S, NOW_MS)).toEqual({
      status: 'ended',
      label: '已結束',
    });
  });

  it('returns live when dtstart <= now < dtend', () => {
    expect(
      computeReservationTimeInfo(
        NOW_S - 5 * MINUTE,
        NOW_S + 25 * MINUTE,
        NOW_MS
      )
    ).toEqual({ status: 'live', label: '進行中' });
  });

  it('returns live at the exact dtstart boundary', () => {
    expect(computeReservationTimeInfo(NOW_S, NOW_S + HOUR, NOW_MS)).toEqual({
      status: 'live',
      label: '進行中',
    });
  });

  it('returns "即將開始" when less than one minute away', () => {
    expect(
      computeReservationTimeInfo(NOW_S + 30, NOW_S + 30 + HOUR, NOW_MS)
    ).toEqual({ status: 'imminent', label: '即將開始' });
  });

  it('returns minutes label when within the hour bucket', () => {
    expect(
      computeReservationTimeInfo(
        NOW_S + 5 * MINUTE,
        NOW_S + 35 * MINUTE,
        NOW_MS
      )
    ).toEqual({ status: 'imminent', label: '5 分鐘後開始' });
  });

  it('returns 59 minutes at one second under the hour boundary', () => {
    expect(
      computeReservationTimeInfo(NOW_S + HOUR - 1, NOW_S + 2 * HOUR, NOW_MS)
    ).toEqual({ status: 'imminent', label: '59 分鐘後開始' });
  });

  it('crosses into the hour bucket exactly at one hour', () => {
    expect(
      computeReservationTimeInfo(NOW_S + HOUR, NOW_S + 2 * HOUR, NOW_MS)
    ).toEqual({ status: 'soon', label: '1 小時後開始' });
  });

  it('returns hours label when within the day bucket', () => {
    expect(
      computeReservationTimeInfo(NOW_S + 5 * HOUR, NOW_S + 6 * HOUR, NOW_MS)
    ).toEqual({ status: 'soon', label: '5 小時後開始' });
  });

  it('returns 23 hours at one second under the day boundary', () => {
    expect(
      computeReservationTimeInfo(NOW_S + DAY - 1, NOW_S + DAY + HOUR, NOW_MS)
    ).toEqual({ status: 'soon', label: '23 小時後開始' });
  });

  it('crosses into the day bucket exactly at 24 hours', () => {
    expect(
      computeReservationTimeInfo(NOW_S + DAY, NOW_S + DAY + HOUR, NOW_MS)
    ).toEqual({ status: 'far', label: '1 天後' });
  });

  it('returns days label for far-future reservations', () => {
    expect(
      computeReservationTimeInfo(
        NOW_S + 3 * DAY,
        NOW_S + 3 * DAY + HOUR,
        NOW_MS
      )
    ).toEqual({ status: 'far', label: '3 天後' });
  });

  it('floors partial days down (1 day 23 hours -> 1 day)', () => {
    expect(
      computeReservationTimeInfo(
        NOW_S + DAY + 23 * HOUR,
        NOW_S + DAY + 24 * HOUR,
        NOW_MS
      )
    ).toEqual({ status: 'far', label: '1 天後' });
  });
});
