import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useGoogleAuth } from '@/hooks/auth/useGoogleAuth';

import GoogleButton from './GoogleButton';

vi.mock('@/hooks/auth/useGoogleAuth', () => ({
  useGoogleAuth: vi.fn(),
}));

const mockUseGoogleAuth = vi.mocked(useGoogleAuth);

describe('GoogleButton', () => {
  it('renders correctly and handles click', () => {
    const handleGoogleAuth = vi.fn();
    mockUseGoogleAuth.mockReturnValue({
      handleGoogleAuth,
      isPending: false,
    });

    render(
      <GoogleButton
        isSubmitting={false}
        isSignIn={true}
        label="使用 Google 帳號登入"
      />
    );

    const button = screen.getByRole('button', { name: /使用 Google 帳號登入/ });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(handleGoogleAuth).toHaveBeenCalledWith(true);
  });

  it('renders sign up label and passes false to handleGoogleAuth on click', () => {
    const handleGoogleAuth = vi.fn();
    mockUseGoogleAuth.mockReturnValue({
      handleGoogleAuth,
      isPending: false,
    });

    render(
      <GoogleButton
        isSubmitting={false}
        isSignIn={false}
        label="使用 Google 帳號註冊"
      />
    );

    const button = screen.getByRole('button', { name: /使用 Google 帳號註冊/ });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(handleGoogleAuth).toHaveBeenCalledWith(false);
  });

  it('is disabled when isSubmitting is true', () => {
    mockUseGoogleAuth.mockReturnValue({
      handleGoogleAuth: vi.fn(),
      isPending: false,
    });

    render(
      <GoogleButton
        isSubmitting={true}
        isSignIn={true}
        label="使用 Google 帳號登入"
      />
    );

    const button = screen.getByRole('button', { name: /使用 Google 帳號登入/ });
    expect(button).toBeDisabled();
  });

  it('is disabled when isPending is true', () => {
    mockUseGoogleAuth.mockReturnValue({
      handleGoogleAuth: vi.fn(),
      isPending: true,
    });

    render(
      <GoogleButton
        isSubmitting={false}
        isSignIn={true}
        label="使用 Google 帳號登入"
      />
    );

    const button = screen.getByRole('button', { name: /使用 Google 帳號登入/ });
    expect(button).toBeDisabled();
  });
});
