import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { AuthFormProps } from '@/components/auth/types';
import { useToast } from '@/components/ui/use-toast';
import { SignUpSchema } from '@/schemas/auth';
import { signUp } from '@/services/auth/signUp';
import { AuthResponse } from '@/services/auth/types';

import { handleSignUpError } from '../../services/auth/signUpErrorHandler';
type SignUpValues = z.infer<typeof SignUpSchema>;

export default function useSignUpForm(): AuthFormProps<SignUpValues> {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof SignUpSchema>>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: {
      email: '',
      password: '',
      hasReadTermsOfService: false,
    },
  });

  const onSubmit = async (values: z.infer<typeof SignUpSchema>) => {
    setIsSubmitting(true);

    try {
      const result = await signUp(values);

      if (result.status === 'success') {
        router.push('/auth/emailVerify');
        return;
      }
    } catch (error) {
      handleSignUpError(error as AuthResponse, toast);
    } finally {
      setIsSubmitting(false);
    }
  };

  return { form, isSubmitting, onSubmit };
}
