import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildDesktopGuestAuth } from '@/hooks/layout/useHeaderNavigation';
import {
  authenticatedIdentity,
  buildResolvedIdentity,
  GUEST_IDENTITY,
  UNKNOWN_IDENTITY,
} from '@/test/mocks/identity';

import { AuthHintProvider } from './AuthHintGate';
import { GuestActionButtons } from './GuestActionButtons';

describe('GuestActionButtons', () => {
  it('returns null and does not render when state is hint-only or confirmed-member', () => {
    const { container: container1 } = render(
      <GuestActionButtons
        identity={buildResolvedIdentity({
          state: 'hint-only',
        })}
      />
    );
    expect(container1).toBeEmptyDOMElement();

    const { container: container2 } = render(
      <GuestActionButtons identity={authenticatedIdentity('user-1')} />
    );
    expect(container2).toBeEmptyDOMElement();
  });

  it('renders buttons with pre-hydration CSS wrapper when state is unknown', () => {
    const { container } = render(
      <GuestActionButtons identity={UNKNOWN_IDENTITY} />
    );

    expect(container.firstElementChild).toHaveClass(
      'hidden',
      'items-center',
      'gap-3',
      'group-data-[auth-state=guest]/auth-state:flex'
    );

    expect(screen.getByRole('link', { name: '註冊' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '登入' })).toBeInTheDocument();
  });

  it('reads identity from AuthHintProvider context and renders buttons directly when confirmed-guest', () => {
    const { container } = render(
      <AuthHintProvider identity={GUEST_IDENTITY}>
        <GuestActionButtons />
      </AuthHintProvider>
    );

    expect(container.firstElementChild).not.toHaveClass('hidden');

    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['註冊', '登入']);

    const signup = screen.getByRole('link', { name: '註冊' });
    const signin = screen.getByRole('link', { name: '登入' });

    expect(signup).toHaveClass(
      'border-brand-500',
      'text-brand-500',
      'hover:text-brand-500',
      'bg-background-white'
    );
    expect(signin).toHaveClass(
      'bg-brand-500',
      'hover:bg-brand-500',
      'text-text-primary'
    );
    expect(signin).not.toHaveClass('hover:bg-brand-600');

    expect(signup).toHaveAttribute('data-analytics-click', 'header_signup');
    expect(signin).toHaveAttribute('data-analytics-click', 'header_signin');
  });

  it('forwards aria-current="page" from shared buildDesktopGuestAuth descriptors', () => {
    const signinActive = buildDesktopGuestAuth('/auth/signin');
    render(
      <GuestActionButtons
        identity={GUEST_IDENTITY}
        signup={signinActive.signup}
        signin={signinActive.signin}
      />
    );

    expect(screen.getByRole('link', { name: '註冊' })).not.toHaveAttribute(
      'aria-current'
    );
    expect(screen.getByRole('link', { name: '登入' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
