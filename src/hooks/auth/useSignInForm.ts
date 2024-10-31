import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
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
      const error = await signIn(values);

      if (error) {
        toast({
          variant: 'destructive',
          description: error.message,
          duration: 1000,
        });
      } else {
        // Handle successful sign-in (e.g., redirect to dashboard)
        router.push('/dashboard');
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
