import { fireEvent, render, screen, within } from '@testing-library/react';
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

const mockUseAuthStatus = vi.fn();
vi.mock('@/hooks/user/auth/useAuthStatus', () => ({
  useAuthStatus: () => mockUseAuthStatus(),
}));

const mockUseSessionHint = vi.fn();
vi.mock('@/hooks/user/auth/useSessionHint', () => ({
  useSessionHint: () => mockUseSessionHint(),
}));

import { mockSession, mockUseSession } from '@/test/mocks/nextAuth';

import { Header } from './Header';

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSessionHint.mockReturnValue({ status: 'unknown' });
  });

  it('disables the second nav link while resolving a logged-in user, instead of falling back to /auth/signup or /', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseAuthStatus.mockReturnValue({
      authKnown: true,
      isLoggedIn: true,
      isMentor: false,
      userId: undefined,
      hasFullUser: false,
      isResolvingUser: true,
    });

    render(<Header />);

    const link = screen.getByRole('link', { name: '成為導師' });
    expect(link).toHaveAttribute('href', '#');
    expect(link).toHaveAttribute('aria-disabled', 'true');

    // dispatchEvent() returns false when a handler called preventDefault().
    const notPrevented = fireEvent.click(link);
    expect(notPrevented).toBe(false);
  });

  it('links straight to the profile edit page once userId has landed and isResolvingUser is false', () => {
    mockUseSession.mockReturnValue({
      data: { ...mockSession, user: { ...mockSession.user, id: 'user-123' } },
      status: 'authenticated',
    });
    mockUseAuthStatus.mockReturnValue({
      authKnown: true,
      isLoggedIn: true,
      isMentor: false,
      userId: 'user-123',
      hasFullUser: true,
      isResolvingUser: false,
    });

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
    mockUseAuthStatus.mockReturnValue({
      authKnown: true,
      isLoggedIn: false,
      isMentor: false,
      userId: undefined,
      hasFullUser: false,
      isResolvingUser: false,
    });

    render(<Header />);

    expect(screen.getByRole('link', { name: '註冊' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '登入' })).toBeInTheDocument();
  });

  it('shows a loading skeleton, not guest actions, before auth is known at all', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseAuthStatus.mockReturnValue({
      authKnown: false,
      isLoggedIn: false,
      isMentor: false,
      userId: undefined,
      hasFullUser: false,
      isResolvingUser: false,
    });

    render(<Header />);

    expect(
      screen.queryByRole('link', { name: '登入' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '註冊' })
    ).not.toBeInTheDocument();
  });

  it('renders both links with CSS data-auth-state visibility toggles before auth is known', () => {
    // `useAuthStatus` defaults `isMentor` to false until it can be
    // determined — this must not leak into the rendered nav link before
    // `authKnown` is true, or a mentor briefly sees the wrong role's label.
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseAuthStatus.mockReturnValue({
      authKnown: false,
      isLoggedIn: false,
      isMentor: false,
      userId: undefined,
      hasFullUser: false,
      isResolvingUser: false,
    });

    render(<Header />);

    const mentorLink = screen.getByRole('link', { name: '我的導師頁面' });
    const menteeLink = screen.getByRole('link', { name: '成為導師' });
    expect(mentorLink).toHaveClass(
      'hidden',
      'group-data-[auth-state=mentor]:block'
    );
    expect(menteeLink).toHaveClass(
      'hidden',
      'group-data-[auth-state=mentee]:block'
    );
  });

  it("renders UserDropdown with hint avatar when logged in per hint but session hasn't resolved yet", () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'loading',
    });
    mockUseSessionHint.mockReturnValue({
      status: 'authenticated',
      isMentor: true,
      avatar: 'hint-avatar.png',
    });
    mockUseAuthStatus.mockReturnValue({
      authKnown: true,
      isLoggedIn: true,
      isMentor: true,
      userId: undefined,
      hasFullUser: false,
      isResolvingUser: true,
    });

    render(<Header />);

    const avatarImgs = screen.getAllByAltText('我的頭像');
    expect(avatarImgs).toHaveLength(2);
    expect(avatarImgs[0]).toHaveAttribute('src', 'hint-avatar.png');
    expect(avatarImgs[1]).toHaveAttribute('src', 'hint-avatar.png');
  });

  it('keeps 尋找導師/關於 X-Talent/提供回饋/漢堡選單 mounted for logged-in users too, hiding them via CSS data-auth-state toggles instead of unmounting them (avoids a flash before authKnown settles)', () => {
    mockUseSession.mockReturnValue({
      data: { ...mockSession, user: { ...mockSession.user, id: 'user-123' } },
      status: 'authenticated',
    });
    mockUseAuthStatus.mockReturnValue({
      authKnown: true,
      isLoggedIn: true,
      isMentor: false,
      userId: 'user-123',
      hasFullUser: true,
      isResolvingUser: false,
    });

    render(<Header />);

    const findMentorLink = screen.getByRole('link', { name: '尋找導師' });
    const aboutLink = screen.getByRole('link', { name: '關於 X-Talent' });
    const feedbackLink = screen.getByRole('link', {
      name: '提供回饋（另開新分頁）',
    });
    const hamburgerTrigger = screen.getByRole('button', {
      name: '開啟導航選單',
    });

    expect(findMentorLink).toHaveClass(
      'group-data-[auth-state=mentee]:hidden',
      'group-data-[auth-state=mentor]:hidden'
    );
    expect(aboutLink).toHaveClass(
      'group-data-[auth-state=mentee]:hidden',
      'group-data-[auth-state=mentor]:hidden'
    );
    expect(feedbackLink).toHaveClass(
      'group-data-[auth-state=mentee]:hidden',
      'group-data-[auth-state=mentor]:hidden'
    );
    expect(hamburgerTrigger.parentElement).toHaveClass(
      'group-data-[auth-state=mentee]:hidden',
      'group-data-[auth-state=mentor]:hidden'
    );
  });

  it('renders pre-hydration avatar placeholder with CSS visibility toggles before auth is known', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseAuthStatus.mockReturnValue({
      authKnown: false,
      isLoggedIn: false,
      isMentor: false,
      userId: undefined,
      hasFullUser: false,
      isResolvingUser: false,
    });

    render(<Header />);

    // Verified the fast-path background image avatar placeholder is rendered in the DOM under !authKnown
    const placeholders = document.querySelectorAll(
      '.size-8.rounded-full.bg-\\[image\\:var\\(--auth-avatar\\)\\]'
    );
    expect(placeholders).toHaveLength(2);
    expect(placeholders[0]).toHaveClass(
      'hidden group-data-[auth-state=mentee]:block group-data-[auth-state=mentor]:block'
    );
    expect(placeholders[1]).toHaveClass(
      'hidden group-data-[auth-state=mentee]:block group-data-[auth-state=mentor]:block'
    );
  });

  it('does not render NotificationBell when logged out', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    mockUseAuthStatus.mockReturnValue({
      authKnown: true,
      isLoggedIn: false,
      isMentor: false,
      userId: undefined,
      hasFullUser: false,
      isResolvingUser: false,
    });

    render(<Header />);
    expect(
      screen.queryByRole('button', { name: '開啟通知選單' })
    ).not.toBeInTheDocument();
  });

  it('renders NotificationBell on both desktop and mobile/tablet when logged in', () => {
    mockUseSession.mockReturnValue({
      data: { ...mockSession, user: { ...mockSession.user, id: 'user-123' } },
      status: 'authenticated',
    });
    mockUseAuthStatus.mockReturnValue({
      authKnown: true,
      isLoggedIn: true,
      isMentor: false,
      userId: 'user-123',
      hasFullUser: true,
      isResolvingUser: false,
    });

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
  });

  it('closes desktop NotificationBell popover when desktop UserDropdown avatar is clicked', () => {
    mockUseSession.mockReturnValue({
      data: {
        ...mockSession,
        user: { ...mockSession.user, id: 'user-123', image: 'avatar.png' },
      },
      status: 'authenticated',
    });
    mockUseAuthStatus.mockReturnValue({
      authKnown: true,
      isLoggedIn: true,
      isMentor: false,
      userId: 'user-123',
      hasFullUser: true,
      isResolvingUser: false,
    });

    render(<Header />);

    const desktopContainer = screen.getByTestId('desktop-header-right');
    const bellButton = within(desktopContainer).getByRole('button', {
      name: '開啟通知選單',
    });
    const avatarButton = within(desktopContainer).getByRole('button', {
      name: '開啟用戶選單',
    });

    expect(screen.queryByText('尚無新通知')).not.toBeInTheDocument();

    fireEvent.click(bellButton);
    expect(screen.getByText('尚無新通知')).toBeInTheDocument();

    // Radix Popover listens to low-level pointerDown and mouseDown on document to close on click-outside
    fireEvent.pointerDown(avatarButton, { bubbles: true });
    fireEvent.mouseDown(avatarButton, { bubbles: true });
    fireEvent.click(avatarButton);

    expect(screen.queryByText('尚無新通知')).not.toBeInTheDocument();
  });

  it('closes mobile NotificationBell popover when mobile MobileUserMenu avatar is clicked', () => {
    mockUseSession.mockReturnValue({
      data: {
        ...mockSession,
        user: { ...mockSession.user, id: 'user-123', image: 'avatar.png' },
      },
      status: 'authenticated',
    });
    mockUseAuthStatus.mockReturnValue({
      authKnown: true,
      isLoggedIn: true,
      isMentor: false,
      userId: 'user-123',
      hasFullUser: true,
      isResolvingUser: false,
    });

    render(<Header />);

    const mobileContainer = screen.getByTestId('mobile-header-right');
    const bellButton = within(mobileContainer).getByRole('button', {
      name: '開啟通知選單',
    });
    const avatarButton = within(mobileContainer).getByRole('button', {
      name: '開啟用戶選單',
    });

    expect(screen.queryByText('尚無新通知')).not.toBeInTheDocument();

    fireEvent.click(bellButton);
    expect(screen.getByText('尚無新通知')).toBeInTheDocument();

    // Radix Popover listens to low-level pointerDown and mouseDown on document to close on click-outside
    fireEvent.pointerDown(avatarButton, { bubbles: true });
    fireEvent.mouseDown(avatarButton, { bubbles: true });
    fireEvent.click(avatarButton);

    expect(screen.queryByText('尚無新通知')).not.toBeInTheDocument();
  });
});
