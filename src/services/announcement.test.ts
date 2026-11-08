import { describe, expect, it } from 'vitest';

import {
  getMaintenanceTimeRemaining,
  isMaintenanceExpired,
} from './announcement';

describe('announcement service tests', () => {
  describe('isMaintenanceExpired', () => {
    it('returns false if data or maintenanceTime is nullish', () => {
      expect(isMaintenanceExpired(null)).toBe(false);
      expect(isMaintenanceExpired(undefined)).toBe(false);
      expect(
        isMaintenanceExpired({
          enabled: true,
          message: 'hello',
          maintenanceTime: '',
        })
      ).toBe(false);
    });

    it('returns false if maintenanceTime is an invalid date string', () => {
      expect(
        isMaintenanceExpired({
          enabled: true,
          message: 'hello',
          maintenanceTime: 'invalid-date',
        })
      ).toBe(false);
    });

    it('returns true if maintenanceTime has passed', () => {
      const pastTime = new Date(Date.now() - 10000).toISOString();
      expect(
        isMaintenanceExpired({
          enabled: true,
          message: 'hello',
          maintenanceTime: pastTime,
        })
      ).toBe(true);
    });

    it('returns false if maintenanceTime is in the future', () => {
      const futureTime = new Date(Date.now() + 10000).toISOString();
      expect(
        isMaintenanceExpired({
          enabled: true,
          message: 'hello',
          maintenanceTime: futureTime,
        })
      ).toBe(false);
    });
  });

  describe('getMaintenanceTimeRemaining', () => {
    it('returns 0 if data or maintenanceTime is nullish', () => {
      expect(getMaintenanceTimeRemaining(null)).toBe(0);
      expect(getMaintenanceTimeRemaining(undefined)).toBe(0);
      expect(
        getMaintenanceTimeRemaining({
          enabled: true,
          message: 'hello',
          maintenanceTime: '',
        })
      ).toBe(0);
    });

    it('returns 0 if maintenanceTime is an invalid date string', () => {
      expect(
        getMaintenanceTimeRemaining({
          enabled: true,
          message: 'hello',
          maintenanceTime: 'invalid-date',
        })
      ).toBe(0);
    });

    it('returns correct remaining time', () => {
      const now = Date.now();
      const futureTime = new Date(now + 10000).toISOString();
      const remaining = getMaintenanceTimeRemaining(
        { enabled: true, message: 'hello', maintenanceTime: futureTime },
        now
      );
      expect(remaining).toBeCloseTo(10000, -2);
    });
  });
});
