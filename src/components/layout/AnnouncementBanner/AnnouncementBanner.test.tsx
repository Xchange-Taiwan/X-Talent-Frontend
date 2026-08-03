import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnnouncementBanner } from './AnnouncementBanner';

// Mock ResizeObserver and provide entries parameter to mock observer callback synchronously
class MockResizeObserver {
  private callback: (
    entries: Array<{
      borderBoxSize?: Array<{ blockSize: number }>;
      contentRect: { height: number };
    }>
  ) => void;

  constructor(
    callback: (
      entries: Array<{
        borderBoxSize?: Array<{ blockSize: number }>;
        contentRect: { height: number };
      }>
    ) => void
  ) {
    this.callback = callback;
  }

  observe(_element: HTMLElement) {
    // Call synchronously to avoid timer queue interactions
    this.callback([
      {
        borderBoxSize: [{ blockSize: 40 }],
        contentRect: { height: 40 },
      },
    ]);
  }

  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

describe('AnnouncementBanner Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    // Reset global fetch mock
    global.fetch = vi.fn();
    // Clear styles set on documentElement
    document.documentElement.style.removeProperty('--banner-height');
  });

  it('renders nothing when API fetch fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    global.fetch = fetchMock;

    render(<AnnouncementBanner />);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
      expect(
        document.documentElement.style.getPropertyValue('--banner-height')
      ).toBe('0px');
    });
  });

  it('renders nothing when announcement is disabled', async () => {
    const data = { enabled: false, message: '維修公告', maintenanceTime: '' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(data)),
      json: () => Promise.resolve(data),
    });
    global.fetch = fetchMock;

    render(<AnnouncementBanner />);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
      expect(
        document.documentElement.style.getPropertyValue('--banner-height')
      ).toBe('0px');
    });
  });

  it('renders nothing when maintenance time has already passed', async () => {
    const pastTime = new Date(Date.now() - 10000).toISOString(); // 10s ago
    const data = {
      enabled: true,
      message: '維修公告',
      maintenanceTime: pastTime,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(data)),
      json: () => Promise.resolve(data),
    });
    global.fetch = fetchMock;

    render(<AnnouncementBanner />);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
      expect(
        document.documentElement.style.getPropertyValue('--banner-height')
      ).toBe('0px');
    });
  });

  it('renders banner and sets CSS variable when enabled and maintenance time is in the future', async () => {
    const futureTime = new Date(Date.now() + 100000).toISOString(); // In the future
    const data = {
      enabled: true,
      message: '即將進行系統維護公告',
      maintenanceTime: futureTime,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(data)),
      json: () => Promise.resolve(data),
    });
    global.fetch = fetchMock;

    render(<AnnouncementBanner />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('即將進行系統維護公告')).toBeInTheDocument();
      // Verify that the CSS variable is correctly populated
      expect(
        document.documentElement.style.getPropertyValue('--banner-height')
      ).toBe('40px');
    });
  });

  it('renders nothing when previously dismissed in the same session', async () => {
    sessionStorage.setItem('announcement-dismissed', 'true');
    const futureTime = new Date(Date.now() + 100000).toISOString();
    const data = {
      enabled: true,
      message: '即將進行系統維護公告',
      maintenanceTime: futureTime,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(data)),
      json: () => Promise.resolve(data),
    });
    global.fetch = fetchMock;

    render(<AnnouncementBanner />);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      document.documentElement.style.getPropertyValue('--banner-height')
    ).toBe('0px');
  });

  it('can be dismissed and resets CSS variable to 0px', async () => {
    const futureTime = new Date(Date.now() + 100000).toISOString();
    const data = {
      enabled: true,
      message: '即將進行系統維護公告',
      maintenanceTime: futureTime,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(data)),
      json: () => Promise.resolve(data),
    });
    global.fetch = fetchMock;

    render(<AnnouncementBanner />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const closeButton = screen.getByLabelText('關閉公告');
    fireEvent.click(closeButton);

    expect(sessionStorage.getItem('announcement-dismissed')).toBe('true');
    expect(screen.queryByRole('alert')).toBeNull();
    // Verify that the CSS variable is correctly reset to 0px
    expect(
      document.documentElement.style.getPropertyValue('--banner-height')
    ).toBe('0px');
  });

  it('automatically hides when maintenance time starts', async () => {
    vi.useFakeTimers();
    const futureTime = new Date(Date.now() + 5000).toISOString(); // 5s in future
    const data = {
      enabled: true,
      message: '倒數自動關閉公告',
      maintenanceTime: futureTime,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(data)),
      json: () => Promise.resolve(data),
    });
    global.fetch = fetchMock;

    render(<AnnouncementBanner />);

    // Flush the fetch and .then() microtasks
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Now the banner should be visible
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Advance fake timers by 5000ms inside act to trigger the auto-hide setTimeout
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Now the banner should be gone
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      document.documentElement.style.getPropertyValue('--banner-height')
    ).toBe('0px');

    vi.useRealTimers();
  });
});
