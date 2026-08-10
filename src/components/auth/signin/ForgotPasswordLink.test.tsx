import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { Form, FormField, FormItem } from '@/components/ui/form';

import ForgotPasswordLink from './ForgotPasswordLink';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const TestWrapper = () => {
  const form = useForm({
    defaultValues: {
      password: '',
    },
  });

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="password"
        render={() => (
          <FormItem>
            <ForgotPasswordLink />
          </FormItem>
        )}
      />
    </Form>
  );
};

describe('ForgotPasswordLink', () => {
  it('renders successfully when wrapped in form context', () => {
    render(<TestWrapper />);
    const linkElement = screen.getByText('忘記密碼');
    expect(linkElement).toBeInTheDocument();
  });

  it('navigates to forgot password page on click', () => {
    render(<TestWrapper />);
    const linkElement = screen.getByText('忘記密碼');
    fireEvent.click(linkElement);
    expect(mockPush).toHaveBeenCalledWith('/auth/password-forgot');
  });
});
