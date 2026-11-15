import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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

    expect(screen.getByRole('link', { name: '註冊' })).toHaveAttribute(
      'data-analytics-click',
      'header_signup'
    );
    expect(screen.getByRole('link', { name: '登入' })).toHaveAttribute(
      'data-analytics-click',
      'header_signin'
    );
  });
});
