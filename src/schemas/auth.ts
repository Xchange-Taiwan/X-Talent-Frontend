import * as z from 'zod';

export const SignInSchema = z.object({
  email: z.string().email('請輸入電子郵件'),
  password: z.string().min(8, { message: '密碼至少需為 8 個字' }),
});

export const SignUpSchema = z
  .object({
    email: z.string().email('請輸入電子郵件'),
    password: z.string().min(8, { message: '密碼至少需為 8 個字' }),
    confirm_password: z.string().min(8, { message: '密碼至少需為 8 個字' }),
    hasReadTermsOfService: z.boolean().refine((hasRead) => hasRead, {
      message: '請確認並同意服務條款',
    }),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: '密碼與確認密碼不符',
    path: ['confirm_password'],
  });

export const PasswordResetSchema = z
  .object({
    password: z.string().min(8, { message: '密碼至少需為 8 個字' }),
    confirm_password: z.string().min(8, { message: '密碼至少需為 8 個字' }),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: '密碼與確認密碼不符',
    path: ['confirm_password'],
  });

export const PasswordForgotSchema = z.object({
  email: z.string().email('請輸入電子郵件'),
});

export const DeleteAccountXCSchema = z.object({
  email: z.string().email('請輸入電子郵件'),
  password: z.string().min(1, '請輸入密碼'),
});

export const DeleteAccountGoogleSchema = z.object({
  email: z.string().email('請輸入電子郵件'),
  id_token: z.string().min(1, '請先完成 Google 身分驗證'),
});
