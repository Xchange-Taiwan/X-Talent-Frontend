import { render } from '@testing-library/react';
import { fromAny, fromPartial } from '@total-typescript/shoehorn';
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
  it('renders without crashing with default mock user', () => {
    const { container } = render(<MobileUserMenu user={buildUser()} />);
    expect(container).toBeDefined();
  });

  it('renders with undefined user without crashing', () => {
    const { container } = render(<MobileUserMenu user={fromAny(undefined)} />);
    expect(container).toBeDefined();
  });
});
