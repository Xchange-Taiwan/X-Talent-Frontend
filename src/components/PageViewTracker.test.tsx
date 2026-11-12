import { fireEvent, render } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PageViewTracker from './PageViewTracker';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

describe('PageViewTracker', () => {
  let mockGtag: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;

  function setScrollMetrics({
    scrollHeight,
    innerHeight,
    scrollY,
  }: {
    scrollHeight: number;
    innerHeight: number;
    scrollY: number;
  }) {
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: scrollHeight,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: innerHeight,
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: scrollY,
    });
  }

  beforeEach(() => {
    mockGtag = vi.fn<(...args: unknown[]) => void>();
    window.gtag = mockGtag;
    window.dataLayer = [];
    window.history.replaceState({}, '', '/');
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(16);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    vi.mocked(usePathname).mockReturnValue('/');
    document.title = 'X-Talent 首頁';
  });

  afterEach(() => {
    delete window.gtag;
    delete window.dataLayer;
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('tracks initial page_view once on mount and tracks SPA route changes without duplicate firing on re-render', () => {
    const { rerender } = render(<PageViewTracker />);

    expect(mockGtag).toHaveBeenCalledTimes(1);
    expect(mockGtag).toHaveBeenLastCalledWith(
      'event',
      'page_view',
      expect.objectContaining({
        page_path: '/',
        page_title: 'X-Talent 首頁',
      })
    );

    // Re-rendering on the same pathname must not duplicate page_view
    rerender(<PageViewTracker />);
    expect(mockGtag).toHaveBeenCalledTimes(1);

    // SPA route change to /mentor-pool emits a new page_view
    window.history.replaceState({}, '', '/mentor-pool');
    vi.mocked(usePathname).mockReturnValue('/mentor-pool');
    rerender(<PageViewTracker />);

    expect(mockGtag).toHaveBeenCalledTimes(2);
    expect(mockGtag).toHaveBeenLastCalledWith(
      'event',
      'page_view',
      expect.objectContaining({
        page_path: '/mentor-pool',
      })
    );
  });

  it('preserves safe query parameters while stripping PII query parameters on page_view', () => {
    window.history.replaceState(
      {},
      '',
      '/about?token=secret-jwt&email=private@example.com&utm_source=digest'
    );
    vi.mocked(usePathname).mockReturnValue('/about');

    render(<PageViewTracker />);

    expect(mockGtag).toHaveBeenCalledWith(
      'event',
      'page_view',
      expect.objectContaining({
        page_path: '/about?utm_source=digest',
      })
    );
  });

  it('emits a single scroll_depth event with percent_scrolled per milestone, deduplicates re-scrolls, and resets on SPA navigation', () => {
    const { rerender } = render(<PageViewTracker />);
    mockGtag.mockClear();

    // Scrollable height = 2000 - 1000 = 1000px. Jump to 550px (55%) -> single scroll_depth with highest crossed milestone (50)
    setScrollMetrics({ scrollHeight: 2000, innerHeight: 1000, scrollY: 550 });
    fireEvent.scroll(window);

    expect(mockGtag).toHaveBeenCalledTimes(1);
    expect(mockGtag).toHaveBeenCalledWith('event', 'scroll_depth', {
      feature: 'engagement',
      percent_scrolled: 50,
      page_path: '/',
    });

    // Scrolling back up to 30% (already crossed) must not re-fire
    setScrollMetrics({ scrollHeight: 2000, innerHeight: 1000, scrollY: 300 });
    fireEvent.scroll(window);
    expect(mockGtag).toHaveBeenCalledTimes(1);

    // Scrolling down to 92% emits 90 once
    setScrollMetrics({ scrollHeight: 2000, innerHeight: 1000, scrollY: 920 });
    fireEvent.scroll(window);
    expect(mockGtag).toHaveBeenCalledTimes(2);
    expect(mockGtag).toHaveBeenLastCalledWith('event', 'scroll_depth', {
      feature: 'engagement',
      percent_scrolled: 90,
      page_path: '/',
    });

    // Navigating to /about resets scroll milestones for the new page
    window.history.replaceState({}, '', '/about');
    vi.mocked(usePathname).mockReturnValue('/about');
    rerender(<PageViewTracker />);
    mockGtag.mockClear();

    setScrollMetrics({ scrollHeight: 2000, innerHeight: 1000, scrollY: 260 });
    fireEvent.scroll(window);
    expect(mockGtag).toHaveBeenCalledTimes(1);
    expect(mockGtag).toHaveBeenCalledWith('event', 'scroll_depth', {
      feature: 'engagement',
      percent_scrolled: 25,
      page_path: '/about',
    });
  });

  it('delegates [data-analytics-click] clicks to button_click without intruding on unannotated buttons', () => {
    render(
      <div>
        <PageViewTracker />
        <a
          href="/mentor-pool"
          onClick={(e) => e.preventDefault()}
          data-analytics-click="header_nav_mentor_pool"
          data-analytics-location="header"
        >
          <span>尋找導師</span>
        </a>
        <button type="button">一般按鈕</button>
      </div>
    );
    mockGtag.mockClear();

    const plainBtn = document.querySelector('button')!;
    fireEvent.click(plainBtn);
    expect(mockGtag).not.toHaveBeenCalled();

    const annotatedSpan = document.querySelector('a span')!;
    fireEvent.click(annotatedSpan);

    expect(mockGtag).toHaveBeenCalledTimes(1);
    expect(mockGtag).toHaveBeenCalledWith(
      'event',
      'button_click',
      expect.objectContaining({
        feature: 'navigation',
        button_id: 'header_nav_mentor_pool',
        button_location: 'header',
        link_url: '/mentor-pool',
      })
    );
  });
});
