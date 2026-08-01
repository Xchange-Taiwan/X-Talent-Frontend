import { render, screen } from '@testing-library/react';
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
    render(<MobileUserMenu user={buildUser({ name: 'Ada Lovelace' })} />);
    const avatarImg = screen.getByRole('img', { name: 'Ada Lovelace 的頭像' });
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
});
