import { describe, expect, it } from 'vitest';

import {
  PasswordForgotSchema,
  PasswordResetSchema,
  SignInSchema,
  SignUpSchema,
} from '@/schemas/auth';

describe('SignInSchema', () => {
  it('valid email and password ≥ 8 chars should pass', () => {
    const result = SignInSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('invalid email format should return 請輸入電子郵件', () => {
    const result = SignInSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
    const issue = result.error!.issues.find((i) => i.path[0] === 'email');
    expect(issue?.message).toBe('請輸入電子郵件');
  });

  it('password shorter than 8 chars should return 密碼至少需為 8 個字', () => {
    const result = SignInSchema.safeParse({
      email: 'user@example.com',
      password: 'short',
    });
    expect(result.success).toBe(false);
    const issue = result.error!.issues.find((i) => i.path[0] === 'password');
    expect(issue?.message).toBe('密碼至少需為 8 個字');
  });
});

describe('SignUpSchema', () => {
  it('all valid fields should pass', () => {
    const result = SignUpSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
      confirm_password: 'password123',
      hasReadTermsOfService: true,
    });
    expect(result.success).toBe(true);
  });

  it('password !== confirm_password should return 密碼與確認密碼不符 on confirm_password path', () => {
    const result = SignUpSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
      confirm_password: 'different123',
      hasReadTermsOfService: true,
    });
    expect(result.success).toBe(false);
    const issue = result.error!.issues.find(
      (i) => i.path[0] === 'confirm_password'
    );
    expect(issue?.message).toBe('密碼與確認密碼不符');
  });

  it('hasReadTermsOfService: false should return 請確認並同意服務條款', () => {
    const result = SignUpSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
      confirm_password: 'password123',
      hasReadTermsOfService: false,
    });
    expect(result.success).toBe(false);
    const issue = result.error!.issues.find(
      (i) => i.path[0] === 'hasReadTermsOfService'
    );
    expect(issue?.message).toBe('請確認並同意服務條款');
  });
});

describe('PasswordResetSchema', () => {
  it('password !== confirm_password should return 密碼與確認密碼不符', () => {
    const result = PasswordResetSchema.safeParse({
      password: 'password123',
      confirm_password: 'different123',
    });
    expect(result.success).toBe(false);
    const issue = result.error!.issues.find(
      (i) => i.path[0] === 'confirm_password'
    );
    expect(issue?.message).toBe('密碼與確認密碼不符');
  });
});

describe('PasswordForgotSchema', () => {
  it('invalid email format should return 請輸入電子郵件', () => {
    const result = PasswordForgotSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
    const issue = result.error!.issues.find((i) => i.path[0] === 'email');
    expect(issue?.message).toBe('請輸入電子郵件');
  });
});
