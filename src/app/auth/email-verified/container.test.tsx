import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
const mockUseConfirmRegister = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/hooks/auth/useConfirmRegister', () => ({
  useConfirmRegister: () => mockUseConfirmRegister(),
}));

import EmailVerifiedContainer from './container';

describe('EmailVerifiedContainer (#953)', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockUseConfirmRegister.mockReset();
  });

  it('renders a stable AuthCard skeleton shell during loading to prevent layout shift', () => {
    mockUseConfirmRegister.mockReturnValue({ status: 'loading' });

    const { container } = render(<EmailVerifiedContainer />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(container.querySelector('.max-w-\\[630px\\]')).not.toBeNull();
    expect(container.querySelector('.h-\\[108px\\]')).not.toBeNull();
  });

  it('renders verification success immediately without lazy-chunk suspense gap and routes to sign-in', async () => {
    const user = userEvent.setup();
    mockUseConfirmRegister.mockReturnValue({ status: 'success' });

    render(<EmailVerifiedContainer />);

    expect(
      screen.getByRole('heading', { name: '驗證成功' })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '設定個人資訊' }));
    expect(mockPush).toHaveBeenCalledWith('/auth/signin');
  });

  it('renders verification failure and routes to sign-up', async () => {
    const user = userEvent.setup();
    mockUseConfirmRegister.mockReturnValue({ status: 'failure' });

    render(<EmailVerifiedContainer />);

    expect(
      screen.getByRole('heading', { name: '驗證失敗' })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '返回重試' }));
    expect(mockPush).toHaveBeenCalledWith('/auth/signup');
  });
});
