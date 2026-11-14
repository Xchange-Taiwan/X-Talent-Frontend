import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  // next/image requires width/height derived from a static-import object
  // shape that Vitest's asset transform doesn't produce; not relevant to
  // the auth-status link logic under test here.
  default: ({ src, alt }: { src: string | { src: string }; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : src.src} alt={alt} />
  ),
}));

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

const trackEvent = vi.fn();
vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    trackEvent: (...args: unknown[]) => trackEvent(...args),
  };
});

const mockUseResolvedIdentity = vi.fn();
vi.mock('@/hooks/user/auth/useResolvedIdentity', () => ({
  useResolvedIdentity: () => mockUseResolvedIdentity(),
}));

import { createInMemoryNotificationSource } from '@/services/notifications/notificationSource';
import {
  notificationStoreManager,
  resetNotificationStore,
} from '@/stores/notificationStore';
import {
  authenticatedIdentity,
  buildResolvedIdentity,
  GUEST_IDENTITY,
  UNKNOWN_IDENTITY,
} from '@/test/mocks/identity';
import { mockSession, mockUseSession } from '@/test/mocks/nextAuth';

import { Header } from './Header';

const AUTHENTICATED_MATCHING_IDENTITY = authenticatedIdentity('user-123');

class NoopIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  disconnect() {}
  observe() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve() {}
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetNotificationStore();
    const headerNotificationSource = createInMemoryNotificationSource([
      {
        id: 'header-notif-1',
        type: 'reservation_requested',
        menteeName: '小明',
        createdAt: new Date().toISOString(),
        unread: true,
      },
    ]);
    notificationStoreManager.setSource('user-123', headerNotificationSource);
    notificationStoreManager.setSource('mentor-999', headerNotificationSource);
    mockUseResolvedIdentity.mockReturnValue(UNKNOWN_IDENTITY);
    global.IntersectionObserver = NoopIntersectionObserver;
  });

  it('disables the second nav link while resolving a logged-in user, instead of falling back to /auth/signup or /', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseResolvedIdentity.mockReturnValue(
      buildResolvedIdentity({
        state: 'hint-only',
      })
    );

    render(<Header />);

    const link = screen.getByRole('link', { name: '成為導師' });
    expect(link).toHaveAttribute('href', '#');
    expect(link).toHaveAttribute('aria-disabled', 'true');

    const notPrevented = fireEvent.click(link);
    expect(notPrevented).toBe(false);
  });

  it('links straight to the profile edit page once userId has landed and isResolvingUser is false', () => {
    mockUseSession.mockReturnValue({
      data: { ...mockSession, user: { ...mockSession.user, id: 'user-123' } },
      status: 'authenticated',
    });
    mockUseResolvedIdentity.mockReturnValue(AUTHENTICATED_MATCHING_IDENTITY);

    render(<Header />);

    const link = screen.getByRole('link', { name: '成為導師' });
    expect(link).toHaveAttribute(
      'href',
      '/profile/user-123/edit?mentor-onboarding=true'
    );
    expect(link).toHaveAttribute('aria-disabled', 'false');
  });

  it('shows guest sign-in/sign-up actions once auth is known and the user is not logged in', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    mockUseResolvedIdentity.mockReturnValue(GUEST_IDENTITY);

    render(<Header />);

    expect(screen.getByRole('link', { name: '註冊' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '登入' })).toBeInTheDocument();
  });

  it('pre-renders guest sign-in/sign-up actions with CSS data-auth-state visibility toggles before auth is known', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });

    render(<Header />);

    const signupLink = screen.getByRole('link', { name: '註冊' });
    const signinLink = screen.getByRole('link', { name: '登入' });
    expect(signupLink.parentElement).toHaveClass(
      'hidden',
      'group-data-[auth-state=guest]/auth-state:flex'
    );
    expect(signinLink.parentElement).toHaveClass(
      'hidden',
      'group-data-[auth-state=guest]/auth-state:flex'
    );
  });

  it('renders both links with CSS data-auth-state visibility toggles before auth is known', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });

    render(<Header />);

    const mentorLink = screen.getByRole('link', { name: '我的導師頁面' });
    const menteeLink = screen.getByRole('link', { name: '成為導師' });
    expect(mentorLink).toHaveClass(
      'hidden',
      'group-data-[auth-state=mentor]/auth-state:block'
    );
    expect(menteeLink).toHaveClass(
      'hidden',
      'group-data-[auth-state=mentee]/auth-state:block'
    );
  });

  it('never disables the guest fast-path "成為導師" link, since isResolvingUser can only be true for a logged-in user', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });

    render(<Header />);

    const menteeLink = screen.getByRole('link', { name: '成為導師' });
    expect(menteeLink).toHaveAttribute('aria-disabled', 'false');
    expect(menteeLink).toHaveAttribute('href', '/auth/signup');
  });

  it("renders UserDropdown with hint avatar when logged in per hint but session hasn't resolved yet", () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'loading',
    });
    mockUseResolvedIdentity.mockReturnValue(
      buildResolvedIdentity({
        state: 'hint-only',
        isMentor: true,
        avatar: 'hint-avatar.png',
      })
    );

    render(<Header />);

    const avatarImgs = screen.getAllByAltText('我的頭像');
    expect(avatarImgs).toHaveLength(2);
    expect(avatarImgs[0]).toHaveAttribute('src', 'hint-avatar.png');
    expect(avatarImgs[1]).toHaveAttribute('src', 'hint-avatar.png');
  });

  it('keeps 尋找導師/關於 X-Talent/提供回饋 mounted for logged-in users too, with navigation links always visible on desktop (avoids a flash before authKnown settles)', () => {
    mockUseSession.mockReturnValue({
      data: { ...mockSession, user: { ...mockSession.user, id: 'user-123' } },
      status: 'authenticated',
    });
    mockUseResolvedIdentity.mockReturnValue(AUTHENTICATED_MATCHING_IDENTITY);
    render(<Header />);

    const findMentorLink = screen.getByRole('link', { name: '尋找導師' });
    const aboutLink = screen.getByRole('link', { name: '關於 X-Talent' });
    const feedbackLink = screen.getByRole('link', {
      name: '提供回饋（另開新分頁）',
    });

    expect(findMentorLink).not.toHaveClass(
      'group-data-[auth-state=mentee]/auth-state:hidden'
    );
    expect(findMentorLink).not.toHaveClass(
      'group-data-[auth-state=mentor]/auth-state:hidden'
    );
    expect(aboutLink).not.toHaveClass(
      'group-data-[auth-state=mentee]/auth-state:hidden'
    );
    expect(aboutLink).not.toHaveClass(
      'group-data-[auth-state=mentor]/auth-state:hidden'
    );
    expect(feedbackLink).not.toHaveClass(
      'group-data-[auth-state=mentee]/auth-state:hidden'
    );
    expect(feedbackLink).not.toHaveClass(
      'group-data-[auth-state=mentor]/auth-state:hidden'
    );
  });

  it('gives the logo and every top-level nav link a visible keyboard focus ring', () => {
    mockUseSession.mockReturnValue({
      data: { ...mockSession, user: { ...mockSession.user, id: 'user-123' } },
      status: 'authenticated',
    });
    mockUseResolvedIdentity.mockReturnValue(AUTHENTICATED_MATCHING_IDENTITY);
    render(<Header />);

    const logoLink = screen.getByRole('link', { name: 'Go to homepage' });
    const findMentorLink = screen.getByRole('link', { name: '尋找導師' });
    const aboutLink = screen.getByRole('link', { name: '關於 X-Talent' });
    const feedbackLink = screen.getByRole('link', {
      name: '提供回饋（另開新分頁）',
    });

    for (const link of [logoLink, findMentorLink, aboutLink, feedbackLink]) {
      expect(link).toHaveClass('focus-visible:ring-2');
      expect(link).toHaveClass('focus-visible:ring-ring');
      expect(link).toHaveClass('focus-visible:outline-none');
    }
  });

  it('tracks feedback_open when the desktop Header "提供回饋" link is clicked', () => {
    trackEvent.mockClear();
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    mockUseResolvedIdentity.mockReturnValue(GUEST_IDENTITY);

    render(<Header />);

    const feedbackLink = screen.getByRole('link', {
      name: '提供回饋（另開新分頁）',
    });
    fireEvent.click(feedbackLink);

    expect(trackEvent).toHaveBeenCalledWith({ name: 'feedback_open' });
  });

  it('renders pre-hydration avatar placeholder with CSS visibility toggles before auth is known', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });

    render(<Header />);

    const placeholders = document.querySelectorAll(
      '.size-8.rounded-full[class~="bg-[image:var(--auth-avatar)]"]'
    );
    expect(placeholders).toHaveLength(2);
    expect(placeholders[0]).toHaveClass(
      'hidden group-data-[auth-state=mentee]/auth-state:block group-data-[auth-state=mentor]/auth-state:block'
    );
    expect(placeholders[1]).toHaveClass(
      'hidden group-data-[auth-state=mentee]/auth-state:block group-data-[auth-state=mentor]/auth-state:block'
    );
  });

  it('renders mobile pre-hydration NotificationBell skeleton placeholder with CSS visibility toggles before auth is known', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });

    render(<Header />);

    const mobileContainer = screen.getByTestId('mobile-header-right');
    const skeleton = mobileContainer.querySelector('.size-9.rounded-full');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass(
      'hidden',
      'group-data-[auth-state=mentee]/auth-state:block',
      'group-data-[auth-state=mentor]/auth-state:block'
    );
  });

  it('does not render NotificationBell when logged out', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    mockUseResolvedIdentity.mockReturnValue(GUEST_IDENTITY);

    render(<Header />);
    expect(
      screen.queryByRole('button', { name: '開啟通知選單' })
    ).not.toBeInTheDocument();
  });

  it('renders NotificationBell on both desktop and mobile/tablet when logged in and bootstraps unread count only once', async () => {
    const sharedSource = notificationStoreManager.getSource('user-123')!;
    const countSpy = vi.spyOn(sharedSource, 'getUnreadCount');

    mockUseSession.mockReturnValue({
      data: { ...mockSession, user: { ...mockSession.user, id: 'user-123' } },
      status: 'authenticated',
    });
    mockUseResolvedIdentity.mockReturnValue(AUTHENTICATED_MATCHING_IDENTITY);
    render(<Header />);

    const desktopContainer = screen.getByTestId('desktop-header-right');
    const mobileContainer = screen.getByTestId('mobile-header-right');

    const desktopBell = within(desktopContainer).getByRole('button', {
      name: '開啟通知選單',
    });
    const mobileBell = within(mobileContainer).getByRole('button', {
      name: '開啟通知選單',
    });

    expect(desktopBell).toBeInTheDocument();
    expect(mobileBell).toBeInTheDocument();

    await waitFor(() => {
      expect(within(desktopBell).getByText('1')).toBeInTheDocument();
      expect(within(mobileBell).getByText('1')).toBeInTheDocument();
    });
    expect(countSpy).toHaveBeenCalledTimes(1);
  });

  it('closes desktop NotificationBell popover when desktop UserDropdown avatar is clicked', async () => {
    mockUseSession.mockReturnValue({
      data: {
        ...mockSession,
        user: { ...mockSession.user, id: 'user-123', image: 'avatar.png' },
      },
      status: 'authenticated',
    });
    mockUseResolvedIdentity.mockReturnValue(AUTHENTICATED_MATCHING_IDENTITY);
    render(<Header />);

    const desktopContainer = screen.getByTestId('desktop-header-right');
    const bellButton = within(desktopContainer).getByRole('button', {
      name: '開啟通知選單',
    });
    const avatarButton = within(desktopContainer).getByRole('button', {
      name: '開啟用戶選單',
    });

    expect(screen.queryAllByText('您有新的預約')).toHaveLength(0);

    fireEvent.click(bellButton);
    expect((await screen.findAllByText('您有新的預約'))[0]).toBeInTheDocument();

    fireEvent.pointerDown(avatarButton, { bubbles: true });
    fireEvent.mouseDown(avatarButton, { bubbles: true });
    fireEvent.click(avatarButton);

    await waitFor(() => {
      expect(screen.queryAllByText('您有新的預約')).toHaveLength(0);
    });
  });

  it('closes mobile NotificationBell popover when mobile MobileUserMenu avatar is clicked', async () => {
    mockUseSession.mockReturnValue({
      data: {
        ...mockSession,
        user: { ...mockSession.user, id: 'user-123', image: 'avatar.png' },
      },
      status: 'authenticated',
    });
    mockUseResolvedIdentity.mockReturnValue(AUTHENTICATED_MATCHING_IDENTITY);
    render(<Header />);

    const mobileContainer = screen.getByTestId('mobile-header-right');
    const bellButton = within(mobileContainer).getByRole('button', {
      name: '開啟通知選單',
    });
    const avatarButton = within(mobileContainer).getByRole('button', {
      name: '開啟用戶選單',
    });

    expect(screen.queryAllByText('您有新的預約')).toHaveLength(0);

    fireEvent.click(bellButton);
    expect((await screen.findAllByText('您有新的預約'))[0]).toBeInTheDocument();

    fireEvent.pointerDown(avatarButton, { bubbles: true });
    fireEvent.mouseDown(avatarButton, { bubbles: true });
    fireEvent.click(avatarButton);

    await waitFor(() => {
      expect(screen.queryAllByText('您有新的預約')).toHaveLength(0);
    });
  });

  describe('navigation links hover style', () => {
    it('applies the underline hover classes to active links', () => {
      mockUseSession.mockReturnValue({
        data: { ...mockSession, user: { ...mockSession.user, id: 'user-123' } },
        status: 'authenticated',
      });
      mockUseResolvedIdentity.mockReturnValue(AUTHENTICATED_MATCHING_IDENTITY);

      render(<Header />);

      const findMentor = screen.getByRole('link', { name: '尋找導師' });
      const about = screen.getByRole('link', { name: '關於 X-Talent' });
      const feedback = screen.getByRole('link', {
        name: '提供回饋（另開新分頁）',
      });
      const leftSecond = screen.getByRole('link', { name: '成為導師' });

      expect(findMentor).toHaveClass(
        'after:bg-brand-500',
        'hover:after:scale-x-100'
      );
      expect(about).toHaveClass(
        'after:bg-brand-500',
        'hover:after:scale-x-100'
      );
      expect(feedback).toHaveClass(
        'after:bg-brand-500',
        'hover:after:scale-x-100'
      );
      expect(leftSecond).toHaveClass(
        'after:bg-brand-500',
        'hover:after:scale-x-100'
      );
    });

    it('excludes the underline hover classes when link is disabled (hint-only)', () => {
      mockUseSession.mockReturnValue({ data: null, status: 'loading' });
      mockUseResolvedIdentity.mockReturnValue(
        buildResolvedIdentity({
          state: 'hint-only',
        })
      );

      render(<Header />);

      const link = screen.getByRole('link', { name: '成為導師' });
      expect(link).not.toHaveClass('after:bg-brand-500');
      expect(link).not.toHaveClass('hover:after:scale-x-100');
    });

    it('attaches declarative GA4 analytics attributes to desktop navigation links (#865)', () => {
      mockUseSession.mockReturnValue({
        data: { ...mockSession, user: { ...mockSession.user, id: 'user-123' } },
        status: 'authenticated',
      });
      mockUseResolvedIdentity.mockReturnValue(AUTHENTICATED_MATCHING_IDENTITY);

      const { unmount } = render(<Header />);

      const becomeMentorLink = screen.getByRole('link', { name: '成為導師' });
      expect(becomeMentorLink).toHaveAttribute(
        'data-analytics-click',
        'header_nav_become_mentor'
      );
      expect(becomeMentorLink).toHaveAttribute(
        'data-analytics-location',
        'header'
      );
      expect(becomeMentorLink).toHaveAttribute(
        'data-analytics-feature',
        'onboarding'
      );

      unmount();
      mockUseResolvedIdentity.mockReturnValue(
        authenticatedIdentity('mentor-999', { isMentor: true })
      );
      render(<Header />);

      const myMentorPageLink = screen.getByRole('link', {
        name: '我的導師頁面',
      });
      expect(myMentorPageLink).toHaveAttribute(
        'data-analytics-click',
        'header_nav_my_mentor_page'
      );
      expect(myMentorPageLink).toHaveAttribute(
        'data-analytics-location',
        'header'
      );
      expect(myMentorPageLink).toHaveAttribute(
        'data-analytics-feature',
        'navigation'
      );
    });
  });
});
