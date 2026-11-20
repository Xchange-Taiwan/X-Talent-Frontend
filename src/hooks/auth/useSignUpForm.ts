import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { AuthFormProps } from '@/components/auth/types';
import { useToast } from '@/components/ui/use-toast';
import { authLifecycle } from '@/lib/auth/sessionLifecycle';
import { SignUpSchema } from '@/schemas/auth';

type SignUpValues = z.infer<typeof SignUpSchema>;

export default function useSignUpForm(): AuthFormProps<SignUpValues> {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlightRef = useRef(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    authLifecycle.trackSignUpStarted();
  }, []);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: {
      email: '',
      password: '',
      confirm_password: '',
      hasReadTermsOfService: false,
    },
  });

  const onSubmit = async (values: SignUpValues) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsSubmitting(true);
    let redirected = false;
    try {
      const result = await authLifecycle.signUpWithCredentials(values, {
        navigate: (href) => router.push(href),
        toast,
      });
      redirected = result.ok;
    } finally {
      inFlightRef.current = false;
      if (!redirected) {
        setIsSubmitting(false);
      }
    }
  };

  return { form, isSubmitting, onSubmit };
}
