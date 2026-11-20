import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { getSession, signIn as clientSignIn } from 'next-auth/react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { AuthFormProps } from '@/components/auth/types';
import { useToast } from '@/components/ui/use-toast';
import { authLifecycle } from '@/lib/auth/sessionLifecycle';
import { SignInSchema } from '@/schemas/auth';

type SignInValues = z.infer<typeof SignInSchema>;

export default function useSignInForm(): AuthFormProps<SignInValues> {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlightRef = useRef(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<SignInValues>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: SignInValues) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsSubmitting(true);
    try {
      await authLifecycle.signInWithCredentials(values, {
        signIn: clientSignIn,
        getSession,
        navigate: (href) => router.push(href),
        toast,
      });
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  return { form, isSubmitting, onSubmit };
}
