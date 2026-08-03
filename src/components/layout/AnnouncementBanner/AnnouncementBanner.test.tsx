import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnnouncementBanner } from './AnnouncementBanner';

// Mock ResizeObserver
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver;

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
    });
  });

  it('renders nothing when announcement is disabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          enabled: false,
          message: '維修公告',
          maintenanceTime: '',
        }),
    });
    global.fetch = fetchMock;

    render(<AnnouncementBanner />);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('renders nothing when maintenance time has already passed', async () => {
    const pastTime = new Date(Date.now() - 10000).toISOString(); // 10s ago
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          enabled: true,
          message: '維修公告',
          maintenanceTime: pastTime,
        }),
    });
    global.fetch = fetchMock;

    render(<AnnouncementBanner />);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('renders banner when enabled and maintenance time is in the future', async () => {
    const futureTime = new Date(Date.now() + 100000).toISOString(); // In the future
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          enabled: true,
          message: '即將進行系統維護公告',
          maintenanceTime: futureTime,
        }),
    });
    global.fetch = fetchMock;

    render(<AnnouncementBanner />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('即將進行系統維護公告')).toBeInTheDocument();
    });
  });

  it('renders nothing when previously dismissed in the same session', async () => {
    sessionStorage.setItem('announcement-dismissed', 'true');
    const futureTime = new Date(Date.now() + 100000).toISOString();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          enabled: true,
          message: '即將進行系統維護公告',
          maintenanceTime: futureTime,
        }),
    });
    global.fetch = fetchMock;

    render(<AnnouncementBanner />);

    // Since we check sessionStorage synchronously before fetching, fetch shouldn't even be called.
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('can be dismissed by clicking the close button', async () => {
    const futureTime = new Date(Date.now() + 100000).toISOString();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          enabled: true,
          message: '即將進行系統維護公告',
          maintenanceTime: futureTime,
        }),
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
  });
});
