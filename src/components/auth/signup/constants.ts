import { AuthFormFieldType } from '@/components/auth/types';

export const formFieldData: AuthFormFieldType<'signup'>[] = [
  {
    name: 'email',
    label: '輸入電子郵件',
    placeholder: '請填入您的 E-mail',
    type: 'text',
    autocomplete: 'email',
  },
  {
    name: 'password',
    label: '登入密碼',
    placeholder: '請輸入密碼',
    type: 'password',
    autocomplete: 'new-password',
  },
  {
    name: 'confirm_password',
    label: '再次輸入密碼',
    placeholder: '請再次輸入密碼',
    type: 'password',
    autocomplete: 'new-password',
  },
];
