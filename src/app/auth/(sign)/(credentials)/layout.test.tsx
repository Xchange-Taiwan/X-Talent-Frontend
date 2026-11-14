import { render, screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/auth.config', () => ({
  default: {},
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';

import AuthCredentialsGuardLayout from './layout';

const mockGetServerSession = vi.mocked(getServerSession);
const mockRedirect = vi.mocked(redirect);

describe('AuthCredentialsGuardLayout (src/app/auth/(sign)/(credentials)/layout.tsx)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders signin/signup children for unauthenticated visitors without redirecting', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const ui = await AuthCredentialsGuardLayout({
      children: <div>Credentials Form</div>,
    });
    render(ui);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(screen.getByText('Credentials Form')).toBeInTheDocument();
  });

  it('redirects authenticated users with onBoarding === false to /auth/onboarding', async () => {
    mockGetServerSession.mockResolvedValueOnce(
      fromPartial({
        user: { id: '42', onBoarding: false, isMentor: false },
      })
    );

    await expect(
      AuthCredentialsGuardLayout({
        children: <div>Credentials Form</div>,
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith('/auth/onboarding');
  });

  it('redirects authenticated users with onBoarding === true to /', async () => {
    mockGetServerSession.mockResolvedValueOnce(
      fromPartial({
        user: { id: '42', onBoarding: true, isMentor: false },
      })
    );

    await expect(
      AuthCredentialsGuardLayout({
        children: <div>Credentials Form</div>,
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith('/');
  });
});
