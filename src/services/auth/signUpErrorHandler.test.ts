import { describe, expect, it, vi } from 'vitest';

import { handleSignUpError } from '@/services/auth/signUpErrorHandler';
import { AuthResponse } from '@/services/types';

type ToastProps = {
  variant: 'default' | 'destructive';
  title: string;
  description?: string;
};

const makeToast = () => vi.fn<(props: ToastProps) => void>();

describe('handleSignUpError', () => {
  it('code: 422 → calls toast with title 驗證失敗 and variant destructive', () => {
    const toast = makeToast();
    const result: AuthResponse = { status: 'error', code: 422 };
    handleSignUpError(result, toast);
    expect(toast).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '驗證失敗', variant: 'destructive' })
    );
  });

  it('code: 406 → calls toast with title 註冊失敗 and variant destructive', () => {
    const toast = makeToast();
    const result: AuthResponse = { status: 'error', code: 406 };
    handleSignUpError(result, toast);
    expect(toast).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '註冊失敗', variant: 'destructive' })
    );
  });

  it('code: 42900 → calls toast with title 請求過於頻繁 and variant destructive', () => {
    const toast = makeToast();
    const result: AuthResponse = { status: 'error', code: 42900 };
    handleSignUpError(result, toast);
    expect(toast).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '請求過於頻繁', variant: 'destructive' })
    );
  });

  it('unknown code → toast description includes HTTP狀態碼', () => {
    const toast = makeToast();
    const result: AuthResponse = {
      status: 'error',
      code: 999,
      httpStatus: 500,
    };
    handleSignUpError(result, toast);
    expect(toast).toHaveBeenCalledOnce();
    const call = toast.mock.calls[0][0];
    expect(call.description).toContain('HTTP狀態碼');
  });

  it('message is provided → description uses the message content', () => {
    const toast = makeToast();
    const result: AuthResponse = {
      status: 'error',
      code: 422,
      message: '電子郵件格式不正確',
    };
    handleSignUpError(result, toast);
    const call = toast.mock.calls[0][0];
    expect(call.description).toContain('電子郵件格式不正確');
  });

  it('message is empty string → description falls back to 發生錯誤。', () => {
    const toast = makeToast();
    const result: AuthResponse = { status: 'error', code: 422, message: '' };
    handleSignUpError(result, toast);
    const call = toast.mock.calls[0][0];
    expect(call.description).toBe('發生錯誤。');
  });
});
