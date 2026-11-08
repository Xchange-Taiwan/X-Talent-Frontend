import { describe, expect, it } from 'vitest';

import { ParsedMentorTimeslot } from '@/lib/profile/bookingAvailability';

import {
  defaultFormForDate,
  fmtTime,
  snapDuration,
  snapMinute,
} from './scheduleFormatters';

function createMockTimeslot(end: Date): ParsedMentorTimeslot {
  return {
    occurrenceId: 'mock-occurrence-id',
    id: 42,
    occurrenceUnix: Math.floor(end.getTime() / 1000) - 1800,
    type: 'ALLOW',
    start: new Date(end.getTime() - 1800 * 1000),
    end,
    durationMinutes: 30,
    formatted: '09:00 – 09:30',
    dateKey: '2026-07-26',
    exdate: [],
    slotDurationSeconds: 1800,
    isRecurringInstance: false,
  };
}

describe('scheduleFormatters', () => {
  describe('fmtTime', () => {
    it('formats unix timestamp to HH:MM in local timezone dynamically to be timezone-invariant', () => {
      // Create local Date objects to dynamically compute timezone-invariant UNIX timestamps
      const d1 = new Date(2026, 6, 26, 0, 0);
      expect(fmtTime(Math.floor(d1.getTime() / 1000))).toBe('00:00');

      const d2 = new Date(2026, 6, 26, 9, 30);
      expect(fmtTime(Math.floor(d2.getTime() / 1000))).toBe('09:30');

      const d3 = new Date(2026, 6, 26, 22, 15);
      expect(fmtTime(Math.floor(d3.getTime() / 1000))).toBe('22:15');
    });
  });

  describe('snapMinute', () => {
    it('snaps minute value to the closest 15-minute mark', () => {
      expect(snapMinute(0)).toBe('00');
      expect(snapMinute(5)).toBe('00');
      expect(snapMinute(8)).toBe('15');
      expect(snapMinute(14)).toBe('15');
      expect(snapMinute(22)).toBe('15');
      expect(snapMinute(37)).toBe('30');
    });

    it('verifies snap behavior at exact boundaries', () => {
      expect(snapMinute(0)).toBe('00');
      expect(snapMinute(7)).toBe('00'); // 7 - 0 = 7, 15 - 7 = 8 -> snaps to 00
      expect(snapMinute(8)).toBe('15'); // 8 - 0 = 8, 15 - 8 = 7 -> snaps to 15
      expect(snapMinute(22)).toBe('15'); // 22 - 15 = 7, 30 - 22 = 8 -> snaps to 15
      expect(snapMinute(23)).toBe('30'); // 23 - 15 = 8, 30 - 23 = 7 -> snaps to 30
      expect(snapMinute(37)).toBe('30'); // 37 - 30 = 7, 45 - 37 = 8 -> snaps to 30
      expect(snapMinute(38)).toBe('45'); // 38 - 30 = 8, 45 - 38 = 7 -> snaps to 45
    });
  });

  describe('snapDuration', () => {
    it('snaps duration to closest option in [30, 45, 60]', () => {
      expect(snapDuration(10)).toBe(30);
      expect(snapDuration(35)).toBe(30);
      expect(snapDuration(38)).toBe(45);
      expect(snapDuration(50)).toBe(45);
      expect(snapDuration(53)).toBe(60);
      expect(snapDuration(90)).toBe(60);
    });
  });

  describe('defaultFormForDate', () => {
    it('returns default of 09:00 with 30 mins duration when there are no existing slots', () => {
      expect(defaultFormForDate([])).toEqual({
        startHour: '09',
        startMinute: '00',
        durationMinutes: 30,
      });
    });

    it('returns starting time right after the last slot ends', () => {
      // 2026-07-26 10:30 local time
      const lastSlot = createMockTimeslot(new Date(2026, 6, 26, 10, 30));
      expect(defaultFormForDate([lastSlot])).toEqual({
        startHour: '10',
        startMinute: '30',
        durationMinutes: 30,
      });
    });

    it('rounds up ending minutes to the next 15-minute mark', () => {
      // Slot ends at 10:35 local, should snap to 10:45
      const lastSlot = createMockTimeslot(new Date(2026, 6, 26, 10, 35));
      expect(defaultFormForDate([lastSlot])).toEqual({
        startHour: '10',
        startMinute: '45',
        durationMinutes: 30,
      });
    });

    it('rolls over the hour if snapped minutes reaches or exceeds 60', () => {
      // Slot ends at 10:50 local -> snapped 15m ceil of 50 is 60 -> should be 11:00
      const lastSlot1 = createMockTimeslot(new Date(2026, 6, 26, 10, 50));
      expect(defaultFormForDate([lastSlot1])).toEqual({
        startHour: '11',
        startMinute: '00',
        durationMinutes: 30,
      });

      // Slot ends at 10:46 local -> snapped 15m ceil is 60 -> should be 11:00
      const lastSlot2 = createMockTimeslot(new Date(2026, 6, 26, 10, 46));
      expect(defaultFormForDate([lastSlot2])).toEqual({
        startHour: '11',
        startMinute: '00',
        durationMinutes: 30,
      });
    });

    it('caps at 23:45 if the rolled over startHour is 24 or greater', () => {
      // Slot ends at 23:50 local -> startH becomes 23 -> snapped startM is 60 -> startH increases to 24 -> caps to 23:45
      const lastSlot = createMockTimeslot(new Date(2026, 6, 26, 23, 50));
      expect(defaultFormForDate([lastSlot])).toEqual({
        startHour: '23',
        startMinute: '45',
        durationMinutes: 30,
      });
    });

    it('caps at 23:45 if the last slot ends on the next calendar day (crossing midnight)', () => {
      // Slot starts at 23:45 local on 2026-07-26, ends at 00:15 local on 2026-07-27.
      // This is a midnight-crossing slot. It should trigger the cap logic and suggest 23:45.
      const lastSlot = createMockTimeslot(new Date(2026, 6, 27, 0, 15));
      expect(defaultFormForDate([lastSlot])).toEqual({
        startHour: '23',
        startMinute: '45',
        durationMinutes: 30,
      });
    });

    it('uses the latest ending slot when multiple slots are provided', () => {
      const earlySlot = createMockTimeslot(new Date(2026, 6, 26, 9, 30));
      const lateSlot = createMockTimeslot(new Date(2026, 6, 26, 14, 15));
      const middleSlot = createMockTimeslot(new Date(2026, 6, 26, 12, 0));

      expect(defaultFormForDate([earlySlot, lateSlot, middleSlot])).toEqual({
        startHour: '14',
        startMinute: '15',
        durationMinutes: 30,
      });
    });
  });
});
