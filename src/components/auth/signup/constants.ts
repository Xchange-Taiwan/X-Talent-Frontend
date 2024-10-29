import { SignUpFormFieldType } from './types';

export const linkStyle =
  'text-sm font-medium text-black underline underline-offset-2';

export const formFieldData: SignUpFormFieldType[] = [
  {
    name: 'email',
    label: '輸入電子郵件',
    placeholder: '請填入您的 E-mail',
    type: 'text',
  },
  {
    name: 'password',
    label: '登入密碼',
    placeholder: '請輸入密碼',
    type: 'password',
  },
  {
    name: 'confirm_password',
    label: '再次輸入密碼',
    placeholder: '請再次輸入密碼',
    type: 'password',
  },
];
