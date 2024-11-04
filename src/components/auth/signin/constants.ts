import { AuthFormFieldType } from '@/components/auth/types';

export const formFieldData: AuthFormFieldType<'signin'>[] = [
  {
    name: 'email',
    label: '電子郵件地址',
    placeholder: '請填入您的 E-mail',
    type: 'text',
    autocomplete: 'email',
  },
  {
    name: 'password',
    label: '登入密碼',
    placeholder: '請輸入密碼',
    type: 'password',
    autocomplete: 'current-password',
  },
];
