import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { FormMockWrapper } from '@/test/mocks/FormMockWrapper';

import ForgotPasswordLink from './ForgotPasswordLink';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('ForgotPasswordLink', () => {
  it('renders successfully when wrapped in form context', () => {
    render(
      <FormMockWrapper>
        <ForgotPasswordLink />
      </FormMockWrapper>
    );
    const linkElement = screen.getByText('忘記密碼');
    expect(linkElement).toBeInTheDocument();
  });

  it('navigates to forgot password page on click', () => {
    render(
      <FormMockWrapper>
        <ForgotPasswordLink />
      </FormMockWrapper>
    );
    const linkElement = screen.getByText('忘記密碼');
    fireEvent.click(linkElement);
    expect(mockPush).toHaveBeenCalledWith('/auth/password-forgot');
  });
});
