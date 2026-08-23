import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  authenticatedIdentity,
  GUEST_IDENTITY,
  UNKNOWN_IDENTITY,
} from '@/test/mocks/identity';

import { HamburgerMenu } from './HamburgerMenu';

function openMenu(): void {
  fireEvent.click(screen.getByRole('button', { name: '開啟導航選單' }));
}

describe('HamburgerMenu', () => {
  it('renders guest navigation options when state is confirmed-guest', () => {
    render(<HamburgerMenu identity={GUEST_IDENTITY} />);
    openMenu();

    const link = screen.getByRole('link', { name: '成為導師' });
    expect(link).toHaveAttribute('href', '/auth/signup');
    expect(link).toHaveAttribute('aria-disabled', 'false');

    expect(screen.getByRole('link', { name: '登入' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '註冊' })).toBeInTheDocument();
  });

  it('renders pre-hydration state when unknown and wraps in CSS toggles', () => {
    render(<HamburgerMenu identity={UNKNOWN_IDENTITY} />);
    openMenu();

    const link = screen.getByRole('link', { name: '成為導師' });
    // In unknown state, isResolvingUser is false, so disabled is false
    expect(link).toHaveAttribute('href', '/auth/signup');
    expect(link).toHaveAttribute('aria-disabled', 'false');
  });

  it('closes the sheet when a normal link is clicked', () => {
    render(<HamburgerMenu identity={GUEST_IDENTITY} />);
    openMenu();

    fireEvent.click(screen.getByRole('link', { name: '成為導師' }));

    expect(
      screen.queryByRole('link', { name: '成為導師' })
    ).not.toBeInTheDocument();
  });

  it('returns null and does not render when identity is logged in', () => {
    const { container } = render(
      <HamburgerMenu identity={authenticatedIdentity('user-123')} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
