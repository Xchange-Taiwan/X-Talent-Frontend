import { zodResolver } from '@hookform/resolvers/zod';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { DeleteAccountXCSchema } from '@/schemas/auth';

import {
  DeleteAccountDialogView,
  type DeleteAccountDialogViewProps,
} from './DeleteAccountDialog';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

type XCValues = z.infer<typeof DeleteAccountXCSchema>;

/**
 * Renders DeleteAccountDialogView with a real react-hook-form + zodResolver
 * instance (not mocked) so tests exercise the actual Zod validation and
 * FormMessage wiring, not a hand-simulated stand-in.
 */
function Harness(
  props: Partial<Omit<DeleteAccountDialogViewProps, 'open' | 'xcForm'>> = {}
): JSX.Element {
  const xcForm = useForm<XCValues>({
    resolver: zodResolver(DeleteAccountXCSchema),
    defaultValues: { email: 'user@example.com', password: '' },
  });

  return (
    <DeleteAccountDialogView
      open={true}
      onOpenChange={props.onOpenChange ?? vi.fn()}
      mode={props.mode ?? 'xc'}
      xcForm={xcForm}
      isSubmitting={props.isSubmitting ?? false}
      blockedByReservations={props.blockedByReservations ?? false}
      onSubmitXC={props.onSubmitXC ?? vi.fn()}
      initiateGoogleReauth={props.initiateGoogleReauth ?? vi.fn()}
    />
  );
}

describe('DeleteAccountDialogView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('xc mode', () => {
    it('blocks submission and shows a validation message when password is empty', async () => {
      const onSubmitXC = vi.fn();
      render(<Harness onSubmitXC={onSubmitXC} />);

      fireEvent.click(screen.getByRole('button', { name: '確認刪除帳號' }));

      expect(await screen.findByText('請輸入密碼')).toBeInTheDocument();
      expect(onSubmitXC).not.toHaveBeenCalled();
    });

    it('submits the entered password once validation passes', async () => {
      const user = userEvent.setup();
      const onSubmitXC = vi.fn().mockResolvedValue(undefined);
      render(<Harness onSubmitXC={onSubmitXC} />);

      await user.type(
        screen.getByPlaceholderText('輸入您的登入密碼'),
        'secret123'
      );
      await user.click(screen.getByRole('button', { name: '確認刪除帳號' }));

      // react-hook-form's handleSubmit invokes the submit handler as
      // (data, event) - match only the first argument's shape.
      await waitFor(() =>
        expect(onSubmitXC).toHaveBeenCalledWith(
          expect.objectContaining({ password: 'secret123' }),
          expect.anything()
        )
      );
    });

    it('disables submit and cancel while submitting, preventing a duplicate click from closing or resubmitting', () => {
      const onOpenChange = vi.fn();
      render(
        <Harness
          isSubmitting
          onSubmitXC={vi.fn()}
          onOpenChange={onOpenChange}
        />
      );

      expect(screen.getByRole('button', { name: '處理中…' })).toBeDisabled();
      const cancelButton = screen.getByRole('button', { name: '取消' });
      expect(cancelButton).toBeDisabled();

      fireEvent.click(cancelButton);
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('closes the dialog when cancel is clicked while not submitting', () => {
      const onOpenChange = vi.fn();
      render(<Harness onSubmitXC={vi.fn()} onOpenChange={onOpenChange} />);

      fireEvent.click(screen.getByRole('button', { name: '取消' }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('google mode', () => {
    it('calls initiateGoogleReauth when the reauth button is clicked', () => {
      const initiateGoogleReauth = vi.fn();
      render(
        <Harness mode="google" initiateGoogleReauth={initiateGoogleReauth} />
      );

      fireEvent.click(
        screen.getByRole('button', { name: '前往 Google 驗證並刪除帳號' })
      );
      expect(initiateGoogleReauth).toHaveBeenCalledTimes(1);
    });

    it('disables the reauth and cancel buttons while submitting', () => {
      const onOpenChange = vi.fn();
      render(
        <Harness mode="google" isSubmitting onOpenChange={onOpenChange} />
      );

      expect(screen.getByRole('button', { name: '處理中…' })).toBeDisabled();
      const cancelButton = screen.getByRole('button', { name: '取消' });
      expect(cancelButton).toBeDisabled();

      fireEvent.click(cancelButton);
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('blockedByReservations', () => {
    it('shows a warning banner and navigates to the reservation page, closing the dialog', () => {
      const onOpenChange = vi.fn();
      render(
        <Harness
          onSubmitXC={vi.fn()}
          blockedByReservations
          onOpenChange={onOpenChange}
        />
      );

      expect(
        screen.getByText('您目前有未完成或未來的預約，請先處理後再刪除帳號。')
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '前往預約管理' }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(mockPush).toHaveBeenCalledWith('/reservation/mentee');
    });

    it('does not show the banner when not blocked', () => {
      render(<Harness onSubmitXC={vi.fn()} />);

      expect(
        screen.queryByText('您目前有未完成或未來的預約，請先處理後再刪除帳號。')
      ).not.toBeInTheDocument();
    });
  });
});
