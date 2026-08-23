import { fireEvent, render, screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import type { Session } from 'next-auth';
import { describe, expect, it, vi } from 'vitest';

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

const trackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

import { authenticatedIdentity } from '@/test/mocks/identity';
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
  it('renders correctly with default mock user showing proper alt text', () => {
    render(
      <MobileUserMenu
        identity={authenticatedIdentity('user-1', { isMentor: false })}
        user={buildUser({ name: 'Ada Lovelace' })}
      />
    );
    const avatarImg = screen.getByRole('img', { name: 'Ada Lovelace 的頭像' });
    expect(avatarImg).toBeInTheDocument();
  });

  it('renders correctly with mentor user showing proper alt text', () => {
    render(
      <MobileUserMenu
        identity={authenticatedIdentity('user-1', { isMentor: true })}
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
        identity={authenticatedIdentity('user-1', { isMentor: false })}
        user={buildUser({
          name: null,
          avatar: null,
        })}
      />
    );
    const fallbackImg = screen.getByRole('img', { name: '我的頭像' });
    expect(fallbackImg).toBeInTheDocument();
  });

  it('renders the merged header navigation links (尋找導師, 關於 X-Talent, 提供回饋) inside the mobile user menu after opening it', () => {
    render(
      <MobileUserMenu
        identity={authenticatedIdentity('user-1', { isMentor: false })}
        user={buildUser()}
      />
    );

    const trigger = screen.getByRole('button', { name: '開啟用戶選單' });
    fireEvent.click(trigger);

    const findMentorLink = screen.getByRole('link', { name: '尋找導師' });
    const aboutLink = screen.getByRole('link', { name: '關於 X-Talent' });
    const feedbackLink = screen.getByRole('link', { name: '提供回饋' });

    expect(findMentorLink).toBeInTheDocument();
    expect(findMentorLink).toHaveAttribute('href', '/mentor-pool');

    expect(aboutLink).toBeInTheDocument();
    expect(aboutLink).toHaveAttribute('href', '/about');

    expect(feedbackLink).toBeInTheDocument();
    expect(feedbackLink).toHaveAttribute(
      'href',
      'https://forms.gle/594hMVdTyoR3Pgtg9'
    );
  });

  it('tracks feedback_open and closes the sheet when 提供回饋 is clicked', () => {
    trackEvent.mockClear();
    render(
      <MobileUserMenu
        identity={authenticatedIdentity('user-1', { isMentor: false })}
        user={buildUser()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '開啟用戶選單' }));
    const feedbackLink = screen.getByRole('link', { name: '提供回饋' });

    fireEvent.click(feedbackLink);

    expect(trackEvent).toHaveBeenCalledWith({ name: 'feedback_open' });
    expect(
      screen.queryByRole('link', { name: '提供回饋' })
    ).not.toBeInTheDocument();
  });
});
