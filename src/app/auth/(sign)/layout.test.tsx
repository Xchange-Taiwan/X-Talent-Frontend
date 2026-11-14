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

import AuthOperationLayout from './layout';

const mockGetServerSession = vi.mocked(getServerSession);
const mockRedirect = vi.mocked(redirect);

describe('AuthOperationLayout (src/app/auth/(sign)/layout.tsx)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the split-cover shell for unauthenticated visitors', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const ui = await AuthOperationLayout({
      children: <div>Auth Child Content</div>,
    });
    render(ui);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(screen.getByText('Auth Child Content')).toBeInTheDocument();
    expect(
      screen.getByText('現在就加入，更加豐富你的職涯！')
    ).toBeInTheDocument();
  });

  it('allows authenticated users with onBoarding === false to render inside the shared split-cover shell', async () => {
    mockGetServerSession.mockResolvedValueOnce(
      fromPartial({
        user: { id: '42', onBoarding: false, isMentor: false },
      })
    );

    const ui = await AuthOperationLayout({
      children: <div>Onboarding Step Content</div>,
    });
    render(ui);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(screen.getByText('Onboarding Step Content')).toBeInTheDocument();
    expect(
      screen.getByText('現在就加入，更加豐富你的職涯！')
    ).toBeInTheDocument();
  });

  it('redirects authenticated users with onBoarding === true to /', async () => {
    mockGetServerSession.mockResolvedValueOnce(
      fromPartial({
        user: { id: '42', onBoarding: true, isMentor: false },
      })
    );

    await expect(
      AuthOperationLayout({
        children: <div>Should Not Render</div>,
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith('/');
  });
});
