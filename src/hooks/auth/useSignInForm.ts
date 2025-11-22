import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { getSession, signIn as clientSignIn } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { AuthFormProps } from '@/components/auth/types';
import { useToast } from '@/components/ui/use-toast';
import { validateSignIn } from '@/lib/actions/signIn';
import { SignInSchema } from '@/schemas/auth';

type SignInValues = z.infer<typeof SignInSchema>;

export default function useSignInForm(): AuthFormProps<SignInValues> {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<SignInValues>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: SignInValues) => {
    setIsSubmitting(true);

    try {
      // 1️⃣ 先做 server-side 驗證（不登入）
      const validated = await validateSignIn(values);
      if (validated.error) {
        toast({
          variant: 'destructive',
          description: validated.error,
          duration: 1000,
        });
        return;
      }

      // 2️⃣ 進行 NextAuth v4 Credentials Login（on client）
      const login = await clientSignIn('credentials', {
        email: validated.email,
        password: validated.password,
        redirect: false,
      });

      if (login?.error) {
        toast({
          variant: 'destructive',
          description: 'Invalid credentials!',
          duration: 1000,
        });
        return;
      }

      // 3️⃣ 取得 session（成功登入後會有 accessToken）
      const session = await getSession();
      if (!session?.accessToken) {
        toast({
          variant: 'destructive',
          description: 'Login failed',
          duration: 1000,
        });
        return;
      }

      // 4️⃣ Redirect
      if (session.user.onBoarding === false) {
        router.push('/auth/onboarding');
      } else {
        router.push('/mentorPool');
      }
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        description: 'Something went wrong!',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return { form, isSubmitting, onSubmit };
}
