import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  authenticatedIdentity,
  GUEST_IDENTITY,
  UNKNOWN_IDENTITY,
} from '@/test/mocks/identity';

import { GuestActionButtons } from './GuestActionButtons';

describe('GuestActionButtons', () => {
  it('returns null and does not render when state is hint-only or confirmed-member', () => {
    const { container: container1 } = render(
      <GuestActionButtons
        identity={{
          state: 'hint-only',
          userId: undefined,
          avatar: undefined,
          isMentor: false,
          isLoggedIn: true,
          hasFullUser: false,
          isResolvingUser: true,
          authKnown: true,
          sessionSettled: false,
        }}
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

    // The wrapper div should have the required classes
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass(
      'hidden',
      'items-center',
      'gap-3',
      'group-data-[auth-state=guest]/auth-state:flex'
    );

    // Buttons should be rendered inside
    expect(screen.getByRole('link', { name: '註冊' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '登入' })).toBeInTheDocument();
  });

  it('renders buttons directly without wrapper when state is confirmed-guest', () => {
    const { container } = render(
      <GuestActionButtons identity={GUEST_IDENTITY} />
    );

    // The wrapper should NOT be there (no hidden class)
    const firstChild = container.firstChild as HTMLElement;
    expect(firstChild).not.toHaveClass('hidden');

    expect(screen.getByRole('link', { name: '註冊' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '登入' })).toBeInTheDocument();
  });
});
