import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAnnouncement } from '@/services/announcement';

import {
  ANNOUNCEMENT_CACHE_TTL_MS,
  announcementReadManager,
  useAnnouncement,
} from './useAnnouncement';

vi.mock('@/services/announcement', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/announcement')>();
  return {
    ...actual,
    fetchAnnouncement: vi.fn(),
  };
});

describe('useAnnouncement hook tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    announcementReadManager.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when API fetch fails', async () => {
    vi.mocked(fetchAnnouncement).mockRejectedValue(new Error('API failure'));

    const { result } = renderHook(() => useAnnouncement());

    await waitFor(() => {
      expect(result.current.visible).toBe(false);
    });
  });

  it('renders nothing when announcement is disabled', async () => {
    vi.mocked(fetchAnnouncement).mockResolvedValue({
      enabled: false,
      message: 'Maintenance Notice',
      maintenanceTime: '',
    });

    const { result } = renderHook(() => useAnnouncement());

    await waitFor(() => {
      expect(result.current.visible).toBe(false);
    });
  });

  it('renders nothing when maintenance time has already passed', async () => {
    const pastTime = new Date(Date.now() - 10000).toISOString();
    vi.mocked(fetchAnnouncement).mockResolvedValue({
      enabled: true,
      message: 'Maintenance Notice',
      maintenanceTime: pastTime,
    });

    const { result } = renderHook(() => useAnnouncement());

    await waitFor(() => {
      expect(result.current.visible).toBe(false);
    });
  });

  it('renders banner when enabled and maintenance time is in the future', async () => {
    const futureTime = new Date(Date.now() + 100000).toISOString();
    vi.mocked(fetchAnnouncement).mockResolvedValue({
      enabled: true,
      message: 'Upcoming maintenance notice',
      maintenanceTime: futureTime,
    });

    const { result } = renderHook(() => useAnnouncement());

    await waitFor(() => {
      expect(result.current.visible).toBe(true);
      expect(result.current.data?.message).toBe('Upcoming maintenance notice');
    });
  });

  it('does not auto-hide when maintenanceTime is an invalid date string', async () => {
    vi.mocked(fetchAnnouncement).mockResolvedValue({
      enabled: true,
      message: 'Invalid date format notice',
      maintenanceTime: 'invalid-date',
    });

    const { result } = renderHook(() => useAnnouncement());

    await waitFor(() => {
      expect(result.current.visible).toBe(true);
    });
  });

  it('does not auto-hide when maintenanceTime is beyond the 32-bit setTimeout limit (~24.8 days)', async () => {
    vi.useFakeTimers();
    const farFutureTime = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    vi.mocked(fetchAnnouncement).mockResolvedValue({
      enabled: true,
      message: 'Far future maintenance',
      maintenanceTime: farFutureTime,
    });

    const { result } = renderHook(() => useAnnouncement());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.visible).toBe(true);

    // Advance fake timers past 25 days
    await act(async () => {
      vi.advanceTimersByTime(25 * 24 * 60 * 60 * 1000);
    });

    expect(result.current.visible).toBe(true);
  });

  it('automatically hides when maintenance time starts', async () => {
    vi.useFakeTimers();
    const futureTime = new Date(Date.now() + 5000).toISOString();
    vi.mocked(fetchAnnouncement).mockResolvedValue({
      enabled: true,
      message: 'Self-closing notice',
      maintenanceTime: futureTime,
    });

    const { result } = renderHook(() => useAnnouncement());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.visible).toBe(true);

    // Advance fake timers by 5000ms
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.visible).toBe(false);
  });

  it('renders nothing when previously dismissed in same session', async () => {
    sessionStorage.setItem('announcement-dismissed', 'true');
    const { result } = renderHook(() => useAnnouncement());

    expect(result.current.visible).toBe(false);
    expect(fetchAnnouncement).not.toHaveBeenCalled();
  });

  it('can be dismissed and remembers in session storage', async () => {
    const futureTime = new Date(Date.now() + 100000).toISOString();
    vi.mocked(fetchAnnouncement).mockResolvedValue({
      enabled: true,
      message: 'Dismissable banner',
      maintenanceTime: futureTime,
    });

    const { result } = renderHook(() => useAnnouncement());

    await waitFor(() => {
      expect(result.current.visible).toBe(true);
    });

    act(() => {
      result.current.handleDismiss();
    });

    expect(sessionStorage.getItem('announcement-dismissed')).toBe('true');
    expect(result.current.visible).toBe(false);
  });

  it('renders and dismisses safely without throwing when sessionStorage throws SecurityError (#902)', async () => {
    const futureTime = new Date(Date.now() + 100000).toISOString();
    vi.mocked(fetchAnnouncement).mockResolvedValue({
      enabled: true,
      message: 'Iframe-safe maintenance notice',
      maintenanceTime: futureTime,
    });

    const getItemSpy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new DOMException('Access is denied', 'SecurityError');
      });
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('Access is denied', 'SecurityError');
      });

    try {
      const { result } = renderHook(() => useAnnouncement());

      await waitFor(() => {
        expect(result.current.visible).toBe(true);
        expect(result.current.data?.message).toBe(
          'Iframe-safe maintenance notice'
        );
      });

      expect(() => {
        act(() => {
          result.current.handleDismiss();
        });
      }).not.toThrow();

      expect(result.current.visible).toBe(false);
    } finally {
      getItemSpy.mockRestore();
      setItemSpy.mockRestore();
    }
  });

  it('handles SecurityError when window.sessionStorage property getter itself throws (#902)', async () => {
    const futureTime = new Date(Date.now() + 100000).toISOString();
    vi.mocked(fetchAnnouncement).mockResolvedValue({
      enabled: true,
      message: 'Restricted cookie mode notice',
      maintenanceTime: futureTime,
    });

    const originalDescriptor = Object.getOwnPropertyDescriptor(
      window,
      'sessionStorage'
    );
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage disabled', 'SecurityError');
      },
    });

    try {
      const { result } = renderHook(() => useAnnouncement());

      await waitFor(() => {
        expect(result.current.visible).toBe(true);
      });

      act(() => {
        result.current.handleDismiss();
      });

      expect(result.current.visible).toBe(false);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window, 'sessionStorage', originalDescriptor);
      }
    }
  });

  it('reuses cached announcement within ANNOUNCEMENT_CACHE_TTL_MS and re-fetches once TTL expires (#902)', async () => {
    vi.useFakeTimers();
    const initialFuture = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    vi.mocked(fetchAnnouncement)
      .mockResolvedValueOnce({
        enabled: false,
        message: '',
        maintenanceTime: '',
      })
      .mockResolvedValueOnce({
        enabled: true,
        message: 'Newly published maintenance alert',
        maintenanceTime: initialFuture,
      });

    const firstMount = renderHook(() => useAnnouncement());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(firstMount.result.current.visible).toBe(false);
    expect(fetchAnnouncement).toHaveBeenCalledTimes(1);
    firstMount.unmount();

    // Remounting before TTL expires reuses cached value without another network call
    await act(async () => {
      vi.advanceTimersByTime(ANNOUNCEMENT_CACHE_TTL_MS - 1000);
    });
    const secondMount = renderHook(() => useAnnouncement());
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchAnnouncement).toHaveBeenCalledTimes(1);
    expect(secondMount.result.current.visible).toBe(false);
    secondMount.unmount();

    // Advancing past ANNOUNCEMENT_CACHE_TTL_MS expires the cache so remount fetches fresh data
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    const thirdMount = renderHook(() => useAnnouncement());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchAnnouncement).toHaveBeenCalledTimes(2);
    expect(thirdMount.result.current.visible).toBe(true);
    expect(thirdMount.result.current.data?.message).toBe(
      'Newly published maintenance alert'
    );
    thirdMount.unmount();
  });
});
