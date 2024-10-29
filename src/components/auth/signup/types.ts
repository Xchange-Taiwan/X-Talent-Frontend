import { UseFormReturn } from 'react-hook-form';
import * as z from 'zod';

import { SignUpSchema } from '@/schemas/auth';

export interface SignUpFormProps {
  form: UseFormReturn<z.infer<typeof SignUpSchema>>;
  isSubmitting: boolean;
  onSubmit: (values: z.infer<typeof SignUpSchema>) => Promise<void>;
}

type SignUpFormFieldName = 'email' | 'password' | 'confirm_password';
export type SignUpFormFieldType = {
  name: SignUpFormFieldName;
  label: string;
  placeholder: string;
  type: string;
};
