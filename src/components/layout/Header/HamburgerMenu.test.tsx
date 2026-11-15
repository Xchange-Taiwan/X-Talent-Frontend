import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
import {
  authenticatedIdentity,
  buildResolvedIdentity,
  GUEST_IDENTITY,
  UNKNOWN_IDENTITY,
} from '@/test/mocks/identity';

import { HamburgerMenu } from './HamburgerMenu';

function HamburgerMenuHarness({
  identity,
}: {
  identity: ResolvedIdentity;
}): JSX.Element {
  const navigation = useHeaderNavigation({ identity });
  return <HamburgerMenu navigation={navigation} />;
}

function openMenu(): void {
  fireEvent.click(screen.getByRole('button', { name: '開啟導航選單' }));
}

describe('HamburgerMenu', () => {
  it('renders guest navigation links, aria-current, external aria-label, and closes sheet on click', () => {
    mockUsePathname.mockReturnValue('/about');
    render(<HamburgerMenuHarness identity={GUEST_IDENTITY} />);
    openMenu();

    const becomeMentorLink = screen.getByRole('link', { name: '成為導師' });
    expect(becomeMentorLink).toHaveAttribute('href', '/auth/signup');
    expect(becomeMentorLink).toHaveAttribute('aria-disabled', 'false');

    const aboutLink = screen.getByRole('link', { name: '關於 X-Talent' });
    expect(aboutLink).toHaveAttribute('aria-current', 'page');

    expect(
      screen.getByRole('link', { name: '提供回饋（另開新分頁）' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '登入' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '註冊' })).toBeInTheDocument();

    fireEvent.click(becomeMentorLink);
    expect(
      screen.queryByRole('link', { name: '成為導師' })
    ).not.toBeInTheDocument();
  });

  it('wraps in AuthHintGate pre-hydration toggles when unknown and returns null when logged in or hint-only', () => {
    const { container, rerender } = render(
      <HamburgerMenuHarness identity={UNKNOWN_IDENTITY} />
    );
    expect(container.firstElementChild).toHaveClass(
      'group-data-[auth-state=mentee]/auth-state:hidden',
      'group-data-[auth-state=mentor]/auth-state:hidden'
    );

    rerender(
      <HamburgerMenuHarness
        identity={buildResolvedIdentity({ state: 'hint-only' })}
      />
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <HamburgerMenuHarness identity={authenticatedIdentity('user-123')} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
