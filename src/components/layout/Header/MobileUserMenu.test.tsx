import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    className,
  }: {
    src: string | { src: string };
    alt: string;
    className?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === 'string' ? src : src.src}
      alt={alt}
      className={className}
    />
  ),
}));

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

const mockUsePathname = vi.fn<() => string>(() => '/');
vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return {
    ...navigationMockFactory(),
    usePathname: () => mockUsePathname(),
  };
});

const trackEvent = vi.fn();
vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    trackEvent: (...args: unknown[]) => trackEvent(...args),
  };
});

import { useHeaderNavigation } from '@/hooks/layout/useHeaderNavigation';
import type { ResolvedIdentity } from '@/lib/auth/sessionHint';
import { authenticatedIdentity } from '@/test/mocks/identity';

import { MobileUserMenu } from './MobileUserMenu';

function MobileUserMenuHarness({
  identity,
}: {
  identity: ResolvedIdentity;
}): JSX.Element {
  const navigation = useHeaderNavigation({ identity });
  return (
    <MobileUserMenu
      profileHeader={navigation.profileHeader}
      menu={navigation.mobileAccountMenu}
    />
  );
}

describe('MobileUserMenu shell', () => {
  beforeEach(() => {
    trackEvent.mockClear();
    mockUsePathname.mockReturnValue('/');
  });

  it('wires trigger and profile-header avatars with hover/focus classes and fallback alt text', () => {
    const { rerender } = render(
      <MobileUserMenuHarness
        identity={authenticatedIdentity('user-1', {
          name: 'Ada Lovelace',
          isMentor: false,
        })}
      />
    );

    const trigger = screen.getByRole('button', { name: '開啟用戶選單' });
    expect(trigger).toHaveClass('group');

    const triggerAvatar = screen.getByRole('img', {
      name: 'Ada Lovelace 的頭像',
    });
    expect(triggerAvatar).toHaveClass(
      'group-hover:opacity-80',
      'group-focus-visible:ring-2'
    );

    fireEvent.click(trigger);

    const profileLink = screen.getByTestId('profile-header-button');
    expect(profileLink.tagName).toBe('A');
    expect(profileLink).toHaveAttribute('href', '/profile/user-1');

    const profileAvatar = within(profileLink).getByRole('img', {
      name: 'Ada Lovelace 的頭像',
    });
    expect(profileAvatar).toHaveClass(
      'hover:opacity-80',
      'group-focus-visible:ring-2'
    );
    expect(profileAvatar).not.toHaveClass('group-hover:opacity-80');

    rerender(
      <MobileUserMenuHarness
        identity={authenticatedIdentity('user-1', {
          name: undefined,
          avatar: undefined,
          isMentor: false,
        })}
      />
    );
    expect(
      screen.getAllByRole('img', { name: '我的頭像' }).length
    ).toBeGreaterThanOrEqual(1);
  });

  it('renders navigable account & general items as semantic links with aria-current and external aria-label', () => {
    mockUsePathname.mockReturnValue('/favorites');
    render(
      <MobileUserMenuHarness
        identity={authenticatedIdentity('user-1', { isMentor: false })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '開啟用戶選單' }));

    const dialog = screen.getByRole('dialog', { name: '用戶選單' });
    expect(dialog).toHaveClass('h-dvh', 'w-screen', 'p-0');
    expect(dialog).not.toHaveClass('p-6');
    expect(dialog.querySelector('.overflow-y-auto')).toHaveClass('p-6');

    const favoritesLink = screen.getByRole('link', { name: '我的收藏' });
    expect(favoritesLink).toHaveAttribute('href', '/favorites');
    expect(favoritesLink).toHaveAttribute('aria-current', 'page');

    const feedbackLink = screen.getByRole('link', {
      name: '提供回饋（另開新分頁）',
    });
    expect(feedbackLink).toHaveAttribute(
      'href',
      'https://forms.gle/594hMVdTyoR3Pgtg9'
    );

    fireEvent.click(feedbackLink);
    expect(trackEvent).toHaveBeenCalledWith({ name: 'feedback_open' });
    expect(
      screen.queryByRole('link', { name: '我的收藏' })
    ).not.toBeInTheDocument();
  });
});
