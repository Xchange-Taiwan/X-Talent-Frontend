import { get } from '@vercel/global-config';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAnnouncement,
  getMaintenanceBypassToken,
  getMaintenanceMode,
} from '@/lib/globalConfig';
import { captureApiFailure } from '@/lib/monitoring';

vi.mock('@vercel/global-config', () => ({
  get: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({
  captureApiFailure: vi.fn(),
  sanitize: vi.fn((text) => text),
}));

const mockGet = vi.mocked(get);
const mockCaptureApiFailure = vi.mocked(captureApiFailure);

describe('globalConfig module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, GLOBAL_CONFIG: 'connection_string' };
  });

  describe('getMaintenanceMode', () => {
    it('returns success and true when the store contains true', async () => {
      mockGet.mockResolvedValue(true);
      const result = await getMaintenanceMode();
      expect(result).toEqual({ success: true, value: true });
      expect(mockGet).toHaveBeenCalledWith('isInMaintenanceMode');
      expect(mockCaptureApiFailure).not.toHaveBeenCalled();
    });

    it('returns success and true when the store contains string "true"', async () => {
      mockGet.mockResolvedValue('true');
      const result = await getMaintenanceMode();
      expect(result).toEqual({ success: true, value: true });
      expect(mockCaptureApiFailure).not.toHaveBeenCalled();
    });

    it('returns success and false when the store contains false', async () => {
      mockGet.mockResolvedValue(false);
      const result = await getMaintenanceMode();
      expect(result).toEqual({ success: true, value: false });
      expect(mockCaptureApiFailure).not.toHaveBeenCalled();
    });

    it('returns success and false when the store contains string "false"', async () => {
      mockGet.mockResolvedValue('false');
      const result = await getMaintenanceMode();
      expect(result).toEqual({ success: true, value: false });
      expect(mockCaptureApiFailure).not.toHaveBeenCalled();
    });

    it('returns success: false and reports failure when the read fails', async () => {
      mockGet.mockRejectedValue(new Error('Fetch failed'));
      const result = await getMaintenanceMode();
      expect(result).toEqual({ success: false, value: false });
      expect(mockCaptureApiFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'global-config:isInMaintenanceMode',
          method: 'GET',
          status: 0,
          message: 'Fetch failed',
        })
      );
    });

    it('returns success: false and reports failure when the read throws a sync error', async () => {
      mockGet.mockImplementation(() => {
        throw new Error('Sync error');
      });
      const result = await getMaintenanceMode();
      expect(result).toEqual({ success: false, value: false });
      expect(mockCaptureApiFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'global-config:isInMaintenanceMode',
          method: 'GET',
          status: 0,
          message: 'Sync error',
        })
      );
    });

    it('returns success: false and reports failure when the read times out', async () => {
      mockGet.mockImplementation(
        () =>
          new Promise((resolve) => {
            // Keep unresolved to trigger timeout
            setTimeout(() => resolve(true), 1000);
          })
      );
      // Use short timeout
      const result = await getMaintenanceMode(50);
      expect(result).toEqual({ success: false, value: false });
      expect(mockCaptureApiFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'global-config:isInMaintenanceMode',
          method: 'GET',
          status: 0,
          message: 'Global Config read timed out after 50ms',
        })
      );
    });

    it('prevents double reporting on late resolution after a timeout', async () => {
      let triggerLateResolve!: (val: unknown) => void;
      mockGet.mockImplementation(() => {
        return new Promise((resolve) => {
          triggerLateResolve = resolve;
        });
      });

      // Triggers timeout first
      const result = await getMaintenanceMode(50);
      expect(result).toEqual({ success: false, value: false });
      expect(mockCaptureApiFailure).toHaveBeenCalledTimes(1);

      // Now resolve the late Promise
      triggerLateResolve(true);

      // Verify no extra report was sent
      expect(mockCaptureApiFailure).toHaveBeenCalledTimes(1);
    });

    it('prevents double reporting on late rejection after a timeout', async () => {
      let triggerLateReject!: (err: Error) => void;
      mockGet.mockImplementation(() => {
        return new Promise((_, reject) => {
          triggerLateReject = reject;
        });
      });

      // Triggers timeout first
      const result = await getMaintenanceMode(50);
      expect(result).toEqual({ success: false, value: false });
      expect(mockCaptureApiFailure).toHaveBeenCalledTimes(1);

      // Now reject the late Promise
      triggerLateReject(new Error('Late network error'));

      // Verify no extra report was sent
      expect(mockCaptureApiFailure).toHaveBeenCalledTimes(1);
    });

    it('successfully resolves Promise even if Sentry captureApiFailure throws an error', async () => {
      mockGet.mockRejectedValue(new Error('Fetch failed'));
      mockCaptureApiFailure.mockImplementation(() => {
        throw new Error('Sentry error');
      });

      // Should still resolve successfully and not hang
      const result = await getMaintenanceMode();
      expect(result).toEqual({ success: false, value: false });
    });

    it('successfully resolves Promise even if Sentry captureApiFailure returns a Rejected Promise', async () => {
      mockGet.mockRejectedValue(new Error('Fetch failed'));
      mockCaptureApiFailure.mockRejectedValue(new Error('Sentry async error'));

      // Should still resolve successfully and not cause unhandled rejection
      const result = await getMaintenanceMode();
      expect(result).toEqual({ success: false, value: false });
    });

    it('prevents silent fail by reporting error even if errorToReport is undefined or falsy', async () => {
      mockGet.mockRejectedValue(undefined); // Reject with undefined
      const result = await getMaintenanceMode();
      expect(result).toEqual({ success: false, value: false });
      expect(mockCaptureApiFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'global-config:isInMaintenanceMode',
          method: 'GET',
          status: 0,
          message: 'Unknown error',
        })
      );
    });
  });

  describe('getAnnouncement', () => {
    const mockAnnouncement = {
      enabled: true,
      message: 'Test message',
      maintenanceTime: '2026-08-16T12:00:00Z',
    };

    it('returns success and announcement data when read successfully', async () => {
      mockGet.mockResolvedValue(mockAnnouncement);
      const result = await getAnnouncement();
      expect(result).toEqual({ success: true, value: mockAnnouncement });
      expect(mockGet).toHaveBeenCalledWith('announcement');
      expect(mockCaptureApiFailure).not.toHaveBeenCalled();
    });

    it('returns success: false and reports failure when the read fails', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));
      const result = await getAnnouncement();
      expect(result).toEqual({ success: false, value: null });
      expect(mockCaptureApiFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'global-config:announcement',
          method: 'GET',
          status: 0,
          message: 'Network error',
        })
      );
    });
  });

  describe('getMaintenanceBypassToken', () => {
    it('returns success and the token string when the store contains one', async () => {
      mockGet.mockResolvedValue('rotated-token-value');
      const result = await getMaintenanceBypassToken();
      expect(result).toEqual({ success: true, value: 'rotated-token-value' });
      expect(mockGet).toHaveBeenCalledWith('maintenanceBypassToken');
      expect(mockCaptureApiFailure).not.toHaveBeenCalled();
    });

    it('returns success and null when the store has no token set', async () => {
      mockGet.mockResolvedValue(undefined);
      const result = await getMaintenanceBypassToken();
      expect(result).toEqual({ success: true, value: null });
      expect(mockCaptureApiFailure).not.toHaveBeenCalled();
    });

    it('returns success and null when the stored value is not a string', async () => {
      mockGet.mockResolvedValue(true);
      const result = await getMaintenanceBypassToken();
      expect(result).toEqual({ success: true, value: null });
    });

    it('returns success: false and reports failure when the read fails', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));
      const result = await getMaintenanceBypassToken();
      expect(result).toEqual({ success: false, value: null });
      expect(mockCaptureApiFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'global-config:maintenanceBypassToken',
          method: 'GET',
          status: 0,
          message: 'Network error',
        })
      );
    });
  });

  describe('when Global/Edge Config is not configured', () => {
    beforeEach(() => {
      delete process.env.GLOBAL_CONFIG;
      delete process.env.EDGE_CONFIG;
    });

    it('getMaintenanceMode returns success: true and value: false without calling get() or capturing failure', async () => {
      const result = await getMaintenanceMode();
      expect(result).toEqual({ success: true, value: false });
      expect(mockGet).not.toHaveBeenCalled();
      expect(mockCaptureApiFailure).not.toHaveBeenCalled();
    });

    it('getAnnouncement returns success: true and value: null without calling get() or capturing failure', async () => {
      const result = await getAnnouncement();
      expect(result).toEqual({ success: true, value: null });
      expect(mockGet).not.toHaveBeenCalled();
      expect(mockCaptureApiFailure).not.toHaveBeenCalled();
    });

    it('getMaintenanceBypassToken returns success: true and value: null without calling get() or capturing failure', async () => {
      const result = await getMaintenanceBypassToken();
      expect(result).toEqual({ success: true, value: null });
      expect(mockGet).not.toHaveBeenCalled();
      expect(mockCaptureApiFailure).not.toHaveBeenCalled();
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });
});
