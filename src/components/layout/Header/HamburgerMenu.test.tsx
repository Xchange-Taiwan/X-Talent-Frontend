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

describe('HamburgerMenu', () => {
  it('renders guest navigation links, aria-current, external aria-label, and closes sheet on click', () => {
    mockUsePathname.mockReturnValue('/about');
    render(<HamburgerMenuHarness identity={GUEST_IDENTITY} />);

    const triggerButton = screen.getByRole('button', { name: '開啟導航選單' });
    const triggerIcon = triggerButton.querySelector('svg');
    expect(triggerIcon).toHaveClass('size-6');
    expect(triggerIcon).not.toHaveClass('size-8');

    fireEvent.click(triggerButton);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('h-dvh');
    expect(dialog).not.toHaveClass('h-screen');

    const becomeMentorLink = screen.getByRole('link', { name: '成為導師' });
    expect(becomeMentorLink).toHaveAttribute('href', '/auth/signup');
    expect(becomeMentorLink).toHaveAttribute('aria-disabled', 'false');

    const aboutLink = screen.getByRole('link', { name: '關於 X-Talent' });
    expect(aboutLink).toHaveAttribute('aria-current', 'page');

    expect(
      screen.getByRole('link', { name: '提供回饋（另開新分頁）' })
    ).toBeInTheDocument();

    const signin = screen.getByRole('link', { name: '登入' });
    const signup = screen.getByRole('link', { name: '註冊' });
    expect(signin).toHaveClass('bg-brand-500', 'text-text-primary', 'w-40');
    expect(signup).toHaveClass('border-brand-500', 'text-brand-500', 'w-40');

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
