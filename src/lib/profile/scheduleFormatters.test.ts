import { describe, expect, it } from 'vitest';

import { ParsedMentorTimeslot } from '@/lib/profile/scheduleHelpers';

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
    it('formats unix timestamp to HH:MM in local timezone (which is UTC in tests)', () => {
      // 0 corresponds to 1970-01-01T00:00:00.000Z
      expect(fmtTime(0)).toBe('00:00');

      // 9:30 AM (9 * 3600 + 30 * 60)
      expect(fmtTime(9 * 3600 + 30 * 60)).toBe('09:30');

      // 10:15 PM (22 * 3600 + 15 * 60)
      expect(fmtTime(22 * 3600 + 15 * 60)).toBe('22:15');
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
      // In UTC, 2026-07-26T10:30:00.000Z ends at 10:30
      const lastSlot = createMockTimeslot(new Date('2026-07-26T10:30:00.000Z'));
      expect(defaultFormForDate([lastSlot])).toEqual({
        startHour: '10',
        startMinute: '30',
        durationMinutes: 30,
      });
    });

    it('rounds up ending minutes to the next 15-minute mark', () => {
      // Slot ends at 10:35, should snap to 10:45
      const lastSlot = createMockTimeslot(new Date('2026-07-26T10:35:00.000Z'));
      expect(defaultFormForDate([lastSlot])).toEqual({
        startHour: '10',
        startMinute: '45',
        durationMinutes: 30,
      });
    });

    it('rolls over the hour if snapped minutes reaches or exceeds 60', () => {
      // Slot ends at 10:50 -> snapped 15m ceil of 50 is 60 -> should be 11:00
      const lastSlot1 = createMockTimeslot(
        new Date('2026-07-26T10:50:00.000Z')
      );
      expect(defaultFormForDate([lastSlot1])).toEqual({
        startHour: '11',
        startMinute: '00',
        durationMinutes: 30,
      });

      // Slot ends at 10:46 -> snapped 15m ceil is 60 -> should be 11:00
      const lastSlot2 = createMockTimeslot(
        new Date('2026-07-26T10:46:00.000Z')
      );
      expect(defaultFormForDate([lastSlot2])).toEqual({
        startHour: '11',
        startMinute: '00',
        durationMinutes: 30,
      });
    });

    it('caps at 23:45 if the rolled over startHour is 24 or greater', () => {
      // Slot ends at 23:50 -> startH becomes 23 -> snapped startM is 60 -> startH increases to 24 -> caps to 23:45
      const lastSlot = createMockTimeslot(new Date('2026-07-26T23:50:00.000Z'));
      expect(defaultFormForDate([lastSlot])).toEqual({
        startHour: '23',
        startMinute: '45',
        durationMinutes: 30,
      });
    });

    it('caps at 23:45 if the last slot ends on the next calendar day (crossing midnight)', () => {
      // Slot starts at 23:45 on 2026-07-26, ends at 00:15 on 2026-07-27.
      // This is a midnight-crossing slot. It should trigger the cap logic and suggest 23:45.
      const lastSlot = createMockTimeslot(new Date('2026-07-27T00:15:00.000Z'));
      expect(defaultFormForDate([lastSlot])).toEqual({
        startHour: '23',
        startMinute: '45',
        durationMinutes: 30,
      });
    });

    it('uses the latest ending slot when multiple slots are provided', () => {
      const earlySlot = createMockTimeslot(
        new Date('2026-07-26T09:30:00.000Z')
      );
      const lateSlot = createMockTimeslot(new Date('2026-07-26T14:15:00.000Z'));
      const middleSlot = createMockTimeslot(
        new Date('2026-07-26T12:00:00.000Z')
      );

      expect(defaultFormForDate([earlySlot, lateSlot, middleSlot])).toEqual({
        startHour: '14',
        startMinute: '15',
        durationMinutes: 30,
      });
    });
  });
});
