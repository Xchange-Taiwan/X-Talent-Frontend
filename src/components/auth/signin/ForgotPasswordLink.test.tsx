import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { FormMockWrapper } from '@/test/mocks/FormMockWrapper';

import ForgotPasswordLink from './ForgotPasswordLink';

describe('ForgotPasswordLink', () => {
  it('renders as a real, keyboard-reachable link pointing to the forgot-password page', () => {
    render(
      <FormMockWrapper defaultValues={{ password: '' }} fieldName="password">
        <ForgotPasswordLink />
      </FormMockWrapper>
    );

    const link = screen.getByRole('link', { name: '忘記密碼' });
    expect(link).toHaveAttribute('href', '/auth/password-forgot');
  });

  it('gives the link a visible keyboard focus ring', () => {
    render(
      <FormMockWrapper defaultValues={{ password: '' }} fieldName="password">
        <ForgotPasswordLink />
      </FormMockWrapper>
    );

    const link = screen.getByRole('link', { name: '忘記密碼' });
    expect(link).toHaveClass('focus-visible:ring-2');
    expect(link).toHaveClass('focus-visible:ring-ring');
  });
});
