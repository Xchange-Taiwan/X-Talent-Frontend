import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import EmailVerifiedPresentation from '@/app/auth/email-verified/ui';
import EmailVerificationPage from '@/app/auth/email-verify/ui';
import PasswordForgotPage from '@/app/auth/password-forgot/page';
import PasswordForgotSuccessPage from '@/app/auth/password-forgot-success/page';
import PasswordResetPage from '@/app/auth/password-reset/page';
import PasswordResetSuccessPage from '@/app/auth/password-reset-success/page';

import AuthCard from './AuthCard';
import AuthMessageCard from './AuthMessageCard';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => new URLSearchParams('token=test-token'),
}));

vi.mock('@/hooks/auth/usePasswordResend', () => ({
  default: () => ({
    isResending: false,
    handleResend: vi.fn(),
    handleChangeEmail: vi.fn(),
  }),
}));

describe('AuthCard & AuthMessageCard consistency (#805)', () => {
  it('renders AuthCard with consistent max-w-[630px], rounded-2xl, border, and shadow-card', () => {
    const { container } = render(
      <AuthCard>
        <h1>Test Card</h1>
      </AuthCard>
    );

    const card = container.querySelector('.max-w-\\[630px\\]');
    expect(card).not.toBeNull();
    expect(card).toHaveClass(
      'border-background-border',
      'bg-background-white',
      'shadow-card',
      'rounded-2xl',
      'border'
    );
  });

  it('renders AuthMessageCard with top bg-auth-card banner, centered status icon, and non-overlapping title spacing', () => {
    const { container } = render(
      <AuthMessageCard icon="/logo.svg" iconAlt="Status Icon" title="狀態標題">
        <p>內容說明</p>
      </AuthMessageCard>
    );

    const banner = container.querySelector('.bg-auth-card');
    expect(banner).not.toBeNull();
    expect(banner).toHaveClass('relative', 'h-[108px]');

    const img = screen.getByAltText('Status Icon');
    expect(img).toBeInTheDocument();

    const heading = screen.getByRole('heading', { level: 1, name: '狀態標題' });
    expect(heading).toBeInTheDocument();
    expect(heading).not.toHaveClass('-mt-5');
    expect(heading.parentElement).toHaveClass('pt-16', 'md:pt-20');
  });

  it('renders /auth/password-reset-success using AuthMessageCard with status icon and without negative title margin', () => {
    render(<PasswordResetSuccessPage />);

    const heading = screen.getByRole('heading', {
      level: 1,
      name: '密碼重設成功',
    });
    expect(heading).toBeInTheDocument();
    expect(heading).not.toHaveClass('-mt-5');
    expect(screen.getByAltText('密碼重設成功')).toBeInTheDocument();

    const loginBtn = screen.getByRole('button', { name: '前往登入' });
    expect(loginBtn).toHaveClass('min-w-[135px]');
    fireEvent.click(loginBtn);
    expect(mockPush).toHaveBeenCalledWith('/auth/signin');
  });

  it('renders /auth/password-forgot and /auth/password-reset with identical AuthCard container specifications', () => {
    const { container: forgotContainer } = render(<PasswordForgotPage />);
    const { container: resetContainer } = render(<PasswordResetPage />);

    const forgotCard = forgotContainer.querySelector('.max-w-\\[630px\\]');
    const resetCard = resetContainer.querySelector('.max-w-\\[630px\\]');

    expect(forgotCard).not.toBeNull();
    expect(resetCard).not.toBeNull();
    expect(forgotCard?.className).toBe(resetCard?.className);

    expect(
      screen.getByRole('heading', { level: 1, name: '忘記密碼' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: '重設密碼' })
    ).toBeInTheDocument();
  });

  it('renders /auth/email-verify, /auth/email-verified, and /auth/password-forgot-success with consistent button widths and card spacing', () => {
    const { unmount: unmount1 } = render(
      <EmailVerificationPage onResendEmail={vi.fn()} onNavigateHome={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: '回首頁' })).toHaveClass(
      'min-w-[135px]',
      'px-6'
    );
    unmount1();

    const { unmount: unmount2 } = render(
      <EmailVerifiedPresentation
        icon="/logo.svg"
        title="驗證成功"
        content="內容"
        btnContent="設定個人資訊"
        onSetProfile={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: '設定個人資訊' })).toHaveClass(
      'min-w-[135px]',
      'px-6'
    );
    unmount2();

    render(<PasswordForgotSuccessPage />);
    expect(screen.getByRole('button', { name: '重新寄送' })).toHaveClass(
      'min-w-[135px]',
      'px-6'
    );
    expect(screen.getByRole('button', { name: '更換信箱' })).toHaveClass(
      'min-w-[135px]',
      'px-6'
    );
  });
});
