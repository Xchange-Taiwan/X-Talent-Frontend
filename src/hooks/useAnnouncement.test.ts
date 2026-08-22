import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAnnouncement } from '@/services/announcement';

import { announcementReadManager, useAnnouncement } from './useAnnouncement';

vi.mock('@/services/announcement', () => ({
  fetchAnnouncement: vi.fn(),
}));

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
});
