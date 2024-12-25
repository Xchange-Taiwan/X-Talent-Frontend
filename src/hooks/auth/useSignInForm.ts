import { zodResolver } from '@hookform/resolvers/zod';
import { getSession } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { AuthFormProps } from '@/components/auth/types';
import { useToast } from '@/components/ui/use-toast';
import { signIn } from '@/lib/actions/signIn';
import { SignInSchema } from '@/schemas/auth';

type SignInValues = z.infer<typeof SignInSchema>;

export default function useSignInForm(): AuthFormProps<SignInValues> {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof SignInSchema>>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof SignInSchema>) => {
    setIsSubmitting(true);

    try {
      await signIn(values);
      const session = await getSession();

      if (!session?.accessToken || session?.accessToken.length === 0) {
        toast({
          variant: 'destructive',
          description: 'Login failed: User data is missing',
          duration: 1000,
        });
        return;
      }

      if (session?.user.onBoarding === false) {
        window.location.href = '/auth/onboarding';
      } else {
        window.location.href = '/mentorlist';
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        description: 'Something went wrong!',
        duration: 1000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return { form, isSubmitting, onSubmit };
}
