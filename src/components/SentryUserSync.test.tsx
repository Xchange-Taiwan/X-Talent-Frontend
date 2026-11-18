import * as Sentry from '@sentry/nextjs';
import { render } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SentryUserSync from './SentryUserSync';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  setUser: vi.fn(),
  setTag: vi.fn(),
}));

describe('SentryUserSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('binds sanitized user id and role tag on authenticated session without PII', () => {
    vi.mocked(useSession).mockReturnValue({
      status: 'authenticated',
      data: {
        expires: '2099-01-01',
        user: {
          id: 'user_42',
          email: 'private@example.com',
          name: 'Real Name',
          isMentor: true,
        },
      },
      update: vi.fn(),
    } as never);

    render(<SentryUserSync />);

    expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'user_42' });
    expect(Sentry.setTag).toHaveBeenCalledWith('user_role', 'mentor');
  });

  it('clears Sentry user and sets guest role upon sign-out or RefreshTokenError', () => {
    vi.mocked(useSession).mockReturnValue({
      status: 'authenticated',
      data: {
        expires: '2099-01-01',
        error: 'RefreshTokenError',
        user: { id: 'user_42', isMentor: false },
      },
      update: vi.fn(),
    } as never);

    render(<SentryUserSync />);

    expect(Sentry.setUser).toHaveBeenCalledWith(null);
    expect(Sentry.setTag).toHaveBeenCalledWith('user_role', 'guest');
  });

  it('does not mutate Sentry user or role while session status is loading', () => {
    vi.mocked(useSession).mockReturnValue({
      status: 'loading',
      data: null,
      update: vi.fn(),
    } as never);

    render(<SentryUserSync />);

    expect(Sentry.setUser).not.toHaveBeenCalled();
    expect(Sentry.setTag).not.toHaveBeenCalled();
  });

  it('rejects email-shaped or empty user.id values and falls back to guest without leaking PII', () => {
    vi.mocked(useSession).mockReturnValue({
      status: 'authenticated',
      data: {
        expires: '2099-01-01',
        user: { id: 'person@example.com', isMentor: true },
      },
      update: vi.fn(),
    } as never);

    render(<SentryUserSync />);

    expect(Sentry.setUser).toHaveBeenCalledWith(null);
    expect(Sentry.setTag).toHaveBeenCalledWith('user_role', 'guest');
  });
});
