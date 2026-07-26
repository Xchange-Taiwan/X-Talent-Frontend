import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

import { mockSession, mockUseSession } from '@/test/mocks/nextAuth';

import { Header } from './Header';

describe('Header', () => {
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

  it('does not flash the mentee-default "成為導師" label for a mentor before auth is known', () => {
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

    expect(
      screen.queryByRole('link', { name: '成為導師' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '我的導師頁面' })
    ).not.toBeInTheDocument();
  });
});
