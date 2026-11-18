import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { useHeaderNavigation } from '@/hooks/layout/useHeaderNavigation';
import type { ResolvedIdentity } from '@/lib/auth/sessionHint';
import { authenticatedIdentity } from '@/test/mocks/identity';

import { UserDropdown } from './UserDropdown';

function UserDropdownHarness({
  identity,
  showFavorites,
}: {
  identity: ResolvedIdentity;
  showFavorites?: boolean;
}): JSX.Element {
  const navigation = useHeaderNavigation({ identity, showFavorites });
  return (
    <UserDropdown
      profileHeader={navigation.profileHeader}
      menu={navigation.desktopAccountMenu}
    />
  );
}

describe('UserDropdown shell', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/');
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function openMenu(): void {
    const trigger = screen.getByRole('button', { name: '開啟用戶選單' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
  }

  it('wires trigger and profile-header avatars with expected hover and group-focus classes', () => {
    render(
      <UserDropdownHarness
        identity={authenticatedIdentity('user-1', {
          name: 'Test User',
          isMentor: false,
        })}
      />
    );

    const trigger = screen.getByRole('button', { name: '開啟用戶選單' });
    expect(trigger).toHaveClass('group');

    const triggerAvatar = screen.getByRole('img', { name: 'Test User 的頭像' });
    expect(triggerAvatar).toHaveClass(
      'group-hover:opacity-80',
      'group-focus-visible:ring-2'
    );

    openMenu();

    const profileLink = screen.getByTestId('profile-header-button');
    expect(profileLink.tagName).toBe('A');
    expect(profileLink).toHaveAttribute('href', '/profile/user-1');
    expect(profileLink).toHaveClass('group');

    const profileAvatar = within(profileLink).getByRole('img', {
      name: 'Test User 的頭像',
    });
    expect(profileAvatar).toHaveClass(
      'hover:opacity-80',
      'group-focus-visible:ring-2'
    );
    expect(profileAvatar).not.toHaveClass('group-hover:opacity-80');
  });

  it('renders navigable items as semantic anchor menuitems and omits mobile-only general nav links', () => {
    mockUsePathname.mockReturnValue('/favorites');
    render(
      <UserDropdownHarness
        identity={authenticatedIdentity('user-1', { isMentor: false })}
      />
    );

    openMenu();

    expect(
      screen.queryByRole('menuitem', { name: '尋找導師' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: '關於 X-Talent' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: /提供回饋/ })
    ).not.toBeInTheDocument();

    const favoritesItem = screen.getByRole('menuitem', { name: '我的收藏' });
    expect(favoritesItem.tagName).toBe('A');
    expect(favoritesItem).toHaveAttribute('href', '/favorites');
    expect(favoritesItem).toHaveAttribute('aria-current', 'page');

    fireEvent.click(favoritesItem);
    expect(
      screen.queryByRole('menuitem', { name: '我的收藏' })
    ).not.toBeInTheDocument();
  });

  it('omits 我的收藏 when headerNavigationModel filters favorites via showFavorites=false', () => {
    render(
      <UserDropdownHarness
        identity={authenticatedIdentity('user-1', { isMentor: false })}
        showFavorites={false}
      />
    );

    openMenu();

    expect(
      screen.queryByRole('menuitem', { name: '我的收藏' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: '我的預約' })
    ).toBeInTheDocument();
  });
});
