import { fireEvent, render } from '@testing-library/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PageViewTracker from './PageViewTracker';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

describe('PageViewTracker', () => {
  let mockGtag: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let nextRafId: number;

  function flushAnimationFrames() {
    const queued = Array.from(rafCallbacks.entries());
    rafCallbacks.clear();
    for (const [, cb] of queued) {
      cb(16);
    }
  }

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

    rafCallbacks = new Map();
    nextRafId = 1;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = nextRafId++;
      rafCallbacks.set(id, cb);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      rafCallbacks.delete(id);
    });

    vi.mocked(usePathname).mockReturnValue('/');
    document.title = 'X-Talent 首頁';
  });

  afterEach(() => {
    delete window.gtag;
    delete window.dataLayer;
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('tracks initial page_view once even under React.StrictMode and tracks SPA route changes', () => {
    const { rerender } = render(
      <React.StrictMode>
        <PageViewTracker />
      </React.StrictMode>
    );

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
    rerender(
      <React.StrictMode>
        <PageViewTracker />
      </React.StrictMode>
    );
    expect(mockGtag).toHaveBeenCalledTimes(1);

    // SPA route change to /mentor-pool emits a new page_view
    window.history.replaceState({}, '', '/mentor-pool');
    document.title = '尋找導師 | XChange Talent Pool';
    vi.mocked(usePathname).mockReturnValue('/mentor-pool');
    rerender(
      <React.StrictMode>
        <PageViewTracker />
      </React.StrictMode>
    );

    expect(mockGtag).toHaveBeenCalledTimes(2);
    expect(mockGtag).toHaveBeenLastCalledWith(
      'event',
      'page_view',
      expect.objectContaining({
        page_path: '/mentor-pool',
        page_title: '尋找導師 | XChange Talent Pool',
      })
    );
  });

  it('prevents stale /profile/[id] document.title containing real user names from leaking on initial hard-load + SPA transition', () => {
    window.history.replaceState({}, '', '/profile/7482008160728084');
    document.title = '王小明 | XChange Talent Pool';
    vi.mocked(usePathname).mockReturnValue('/profile/7482008160728084');

    const { rerender } = render(<PageViewTracker />);

    expect(mockGtag).toHaveBeenLastCalledWith(
      'event',
      'page_view',
      expect.objectContaining({
        page_path: '/profile/7482008160728084',
        page_title: 'User Profile',
      })
    );

    // Simulate SPA transition to /mentor-pool BEFORE Next.js updates document.title
    mockGtag.mockClear();
    window.history.replaceState({}, '', '/mentor-pool');
    vi.mocked(usePathname).mockReturnValue('/mentor-pool');
    rerender(<PageViewTracker />);

    expect(mockGtag).toHaveBeenCalledTimes(1);
    const [, , sentParams] = mockGtag.mock.calls[0]!;
    expect(sentParams).toMatchObject({
      page_path: '/mentor-pool',
      page_title: 'X-Talent',
    });
    expect(JSON.stringify(sentParams)).not.toContain('王小明');
  });

  it('tracks async document.title streaming during multi-hop SPA route (/mentor-pool -> /profile/[id] -> /about) and redacts stale user names', async () => {
    window.history.replaceState({}, '', '/mentor-pool');
    document.title = '尋找導師 | XChange Talent Pool';
    vi.mocked(usePathname).mockReturnValue('/mentor-pool');

    const { rerender } = render(<PageViewTracker />);

    // Step 1: SPA navigate into /profile/7482008160728084 while document.title is still the previous page's title
    mockGtag.mockClear();
    window.history.replaceState({}, '', '/profile/7482008160728084');
    vi.mocked(usePathname).mockReturnValue('/profile/7482008160728084');
    rerender(<PageViewTracker />);

    expect(mockGtag).toHaveBeenCalledWith(
      'event',
      'page_view',
      expect.objectContaining({
        page_path: '/profile/7482008160728084',
        page_title: 'User Profile',
      })
    );

    // Step 2: Simulate Next.js asynchronously streaming the user's real-name title onto <title>
    document.title = '王小明 | XChange Talent Pool';
    await Promise.resolve();

    // Step 3: SPA navigate away to /about BEFORE Next.js commits /about's new <title>
    mockGtag.mockClear();
    window.history.replaceState({}, '', '/about');
    vi.mocked(usePathname).mockReturnValue('/about');
    rerender(<PageViewTracker />);

    expect(mockGtag).toHaveBeenCalledTimes(1);
    const [, , sentParams] = mockGtag.mock.calls[0]!;
    expect(sentParams).toMatchObject({
      page_path: '/about',
      page_title: 'X-Talent',
    });
    expect(JSON.stringify(sentParams)).not.toContain('王小明');
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

  it('coalesces same-frame scrolls via rAF, emits all newly crossed milestones [25, 50, 75, 100] in order, detaches at 100%, and resets on SPA navigation', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { rerender } = render(
      <React.StrictMode>
        <PageViewTracker />
      </React.StrictMode>
    );
    mockGtag.mockClear();

    // Non-scrollable page (scrollHeight <= innerHeight) emits nothing
    setScrollMetrics({ scrollHeight: 800, innerHeight: 1000, scrollY: 0 });
    fireEvent.scroll(window);
    flushAnimationFrames();
    expect(mockGtag).not.toHaveBeenCalled();

    // Multiple scrolls inside a single animation frame coalesce into 1 rAF schedule.
    // Scrollable height = 2000 - 1000 = 1000px. Reaching 550px (55%) crosses 25 and 50 in order.
    setScrollMetrics({ scrollHeight: 2000, innerHeight: 1000, scrollY: 150 });
    fireEvent.scroll(window);
    setScrollMetrics({ scrollHeight: 2000, innerHeight: 1000, scrollY: 320 });
    fireEvent.scroll(window);
    setScrollMetrics({ scrollHeight: 2000, innerHeight: 1000, scrollY: 550 });
    fireEvent.scroll(window);
    expect(rafCallbacks.size).toBe(1);

    flushAnimationFrames();

    expect(mockGtag).toHaveBeenCalledTimes(2);
    expect(mockGtag).toHaveBeenNthCalledWith(
      1,
      'event',
      'scroll_depth',
      expect.objectContaining({
        feature: 'engagement',
        percent_scrolled: 25,
        page_path: '/',
      })
    );
    expect(mockGtag).toHaveBeenNthCalledWith(
      2,
      'event',
      'scroll_depth',
      expect.objectContaining({
        feature: 'engagement',
        percent_scrolled: 50,
        page_path: '/',
      })
    );

    // Scrolling back up to 30% (already crossed) must not re-fire
    setScrollMetrics({ scrollHeight: 2000, innerHeight: 1000, scrollY: 300 });
    fireEvent.scroll(window);
    flushAnimationFrames();
    expect(mockGtag).toHaveBeenCalledTimes(2);

    // Scrolling down to 100% emits 75 and 100 in ascending order and detaches scroll listener
    removeSpy.mockClear();
    setScrollMetrics({ scrollHeight: 2000, innerHeight: 1000, scrollY: 1000 });
    fireEvent.scroll(window);
    flushAnimationFrames();

    expect(mockGtag).toHaveBeenCalledTimes(4);
    expect(mockGtag).toHaveBeenNthCalledWith(
      3,
      'event',
      'scroll_depth',
      expect.objectContaining({
        feature: 'engagement',
        percent_scrolled: 75,
        page_path: '/',
      })
    );
    expect(mockGtag).toHaveBeenNthCalledWith(
      4,
      'event',
      'scroll_depth',
      expect.objectContaining({
        feature: 'engagement',
        percent_scrolled: 100,
        page_path: '/',
      })
    );
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));

    // Navigating to /about resets scroll milestones for the new page
    window.history.replaceState({}, '', '/about');
    vi.mocked(usePathname).mockReturnValue('/about');
    rerender(
      <React.StrictMode>
        <PageViewTracker />
      </React.StrictMode>
    );
    mockGtag.mockClear();

    setScrollMetrics({ scrollHeight: 2000, innerHeight: 1000, scrollY: 260 });
    fireEvent.scroll(window);
    flushAnimationFrames();

    expect(mockGtag).toHaveBeenCalledTimes(1);
    expect(mockGtag).toHaveBeenCalledWith(
      'event',
      'scroll_depth',
      expect.objectContaining({
        feature: 'engagement',
        percent_scrolled: 25,
        page_path: '/about',
      })
    );
  });

  it('cancels pending rAF and detaches global click/scroll listeners on unmount', () => {
    const docRemoveSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<PageViewTracker />);
    mockGtag.mockClear();

    setScrollMetrics({ scrollHeight: 2000, innerHeight: 1000, scrollY: 500 });
    fireEvent.scroll(window);
    expect(rafCallbacks.size).toBe(1);

    unmount();

    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    expect(rafCallbacks.size).toBe(0);
    expect(docRemoveSpy).toHaveBeenCalledWith(
      'click',
      expect.any(Function),
      expect.objectContaining({ capture: true })
    );
  });

  it('delegates [data-analytics-click] and custom funnel events without intruding on unannotated buttons', () => {
    render(
      <div>
        <PageViewTracker />
        <Link
          id="nav-link"
          href="/mentor-pool"
          prefetch={false}
          onClick={(e) => e.preventDefault()}
          data-analytics-click="header_nav_mentor_pool"
          data-analytics-location="header"
        >
          <span>尋找導師</span>
        </Link>
        <Link
          id="mentor-card-link"
          href="/profile/7482008160728084"
          prefetch={false}
          onClick={(e) => e.preventDefault()}
          data-analytics-click="mentor_card"
          data-analytics-event="mentor_card_click"
          data-analytics-feature="mentor_pool"
          data-analytics-location="mentor_pool_list"
          data-analytics-param-mentor-id="7482008160728084"
        >
          <span>導師卡片</span>
        </Link>
        <button type="button">一般按鈕</button>
      </div>
    );
    mockGtag.mockClear();

    const plainBtn = document.querySelector('button')!;
    fireEvent.click(plainBtn);
    expect(mockGtag).not.toHaveBeenCalled();

    const annotatedSpan = document.querySelector('#nav-link span')!;
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

    const cardSpan = document.querySelector('#mentor-card-link span')!;
    fireEvent.click(cardSpan);

    expect(mockGtag).toHaveBeenCalledTimes(2);
    expect(mockGtag).toHaveBeenLastCalledWith(
      'event',
      'mentor_card_click',
      expect.objectContaining({
        feature: 'mentor_pool',
        button_id: 'mentor_card',
        button_location: 'mentor_pool_list',
        mentor_id: '7482008160728084',
        link_url: '/profile/7482008160728084',
      })
    );
  });

  it('redacts real user names even when <title> updates synchronously during SPA commit onto /profile/[id] or across consecutive profile hops', () => {
    window.history.replaceState({}, '', '/mentor-pool');
    document.title = '尋找導師 | XChange Talent Pool';
    vi.mocked(usePathname).mockReturnValue('/mentor-pool');

    const { rerender } = render(<PageViewTracker />);

    // Synchronous commit: <title> already updated to user name before useEffect runs
    mockGtag.mockClear();
    window.history.replaceState({}, '', '/profile/7482008160728084');
    document.title = '陳小華 | XChange Talent Pool';
    vi.mocked(usePathname).mockReturnValue('/profile/7482008160728084');
    rerender(<PageViewTracker />);

    // Hop to a second profile page and then leave to /about before /about updates <title>
    window.history.replaceState({}, '', '/profile/7482008160728085');
    vi.mocked(usePathname).mockReturnValue('/profile/7482008160728085');
    rerender(<PageViewTracker />);

    mockGtag.mockClear();
    window.history.replaceState({}, '', '/about');
    vi.mocked(usePathname).mockReturnValue('/about');
    rerender(<PageViewTracker />);

    expect(mockGtag).toHaveBeenCalledTimes(1);
    const [, , params] = mockGtag.mock.calls[0]!;
    expect(params).toMatchObject({
      page_path: '/about',
      page_title: 'X-Talent',
    });
    expect(JSON.stringify(params)).not.toContain('陳小華');
  });
});
