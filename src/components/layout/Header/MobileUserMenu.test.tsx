import { fireEvent, render, screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import type { Session } from 'next-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
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

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

import { trackEvent } from '@/lib/analytics';
import { mockSession } from '@/test/mocks/nextAuth';

import { MobileUserMenu } from './MobileUserMenu';

function buildUser(overrides: Partial<Session['user']> = {}): Session['user'] {
  return fromPartial({
    ...mockSession.user,
    id: 'user-1',
    isMentor: false,
    ...overrides,
  });
}

describe('MobileUserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with default mock user showing proper alt text', () => {
    render(<MobileUserMenu user={buildUser({ name: 'Ada Lovelace' })} />);
    const avatarImg = screen.getByRole('img', { name: 'Ada Lovelace 的頭像' });
    expect(avatarImg).toBeInTheDocument();
  });

  it('renders correctly with mentor user showing proper alt text', () => {
    render(
      <MobileUserMenu
        user={buildUser({ name: '陳導師 (Mentor)', isMentor: true })}
      />
    );
    const avatarImg = screen.getByRole('img', {
      name: '陳導師 (Mentor) 的頭像',
    });
    expect(avatarImg).toBeInTheDocument();
  });

  it('renders with anonymous user safely with fallback alt text', () => {
    render(
      <MobileUserMenu
        user={buildUser({
          name: null,
          avatar: null,
        })}
      />
    );
    const fallbackImg = screen.getByRole('img', { name: '我的頭像' });
    expect(fallbackImg).toBeInTheDocument();
  });

  it('calls trackEvent and closeMenu when clicking the "提供回饋" link', () => {
    render(<MobileUserMenu user={buildUser()} />);

    // Open user menu
    const trigger = screen.getByRole('button', { name: '開啟用戶選單' });
    fireEvent.click(trigger);

    const feedbackLink = screen.getByRole('link', { name: '提供回饋' });
    fireEvent.click(feedbackLink);

    expect(trackEvent).toHaveBeenCalledWith({ name: 'feedback_open' });
    // Verify menu closed (the feedback link is no longer visible)
    expect(
      screen.queryByRole('link', { name: '提供回饋' })
    ).not.toBeInTheDocument();
  });

  it('renders "我的導師頁面" link if user is a mentor, but not if they are a guest/mentee', () => {
    // 1. Mentee (isMentor: false)
    const { rerender } = render(
      <MobileUserMenu user={buildUser({ isMentor: false, id: 'user-123' })} />
    );
    // Open user menu
    const trigger = screen.getByRole('button', { name: '開啟用戶選單' });
    fireEvent.click(trigger);

    expect(
      screen.queryByRole('link', { name: '我的導師頁面' })
    ).not.toBeInTheDocument();

    // 2. Mentor (isMentor: true)
    rerender(
      <MobileUserMenu user={buildUser({ isMentor: true, id: 'user-123' })} />
    );
    expect(
      screen.getByRole('link', { name: '我的導師頁面' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '我的導師頁面' })).toHaveAttribute(
      'href',
      '/profile/user-123'
    );
  });
});
