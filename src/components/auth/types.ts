import { FieldValues, UseFormReturn } from 'react-hook-form';

export interface AuthFormProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  isSubmitting: boolean;
  onSubmit: (values: T) => Promise<void>;
}

export type AuthPageType = 'signin' | 'signup';
type AuthFieldNames<T extends AuthPageType> = T extends 'signin'
  ? 'email' | 'password'
  : 'email' | 'password' | 'confirm_password';

export type AuthFormFieldType<T extends AuthPageType> = {
  name: AuthFieldNames<T>;
  label: string;
  placeholder: string;
  type: string;
};
