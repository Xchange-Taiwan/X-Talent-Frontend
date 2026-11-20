import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { useToast } from '@/components/ui/use-toast';
import { authLifecycle } from '@/lib/auth/sessionLifecycle';
import { PasswordResetSchema } from '@/schemas/auth';

import { useAuthPendingAction } from './useAuthPendingAction';

type PasswordResetValues = z.infer<typeof PasswordResetSchema>;

export default function usePasswordResetForm() {
  const { isPending: isSubmitting, runPending } = useAuthPendingAction();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const form = useForm<PasswordResetValues>({
    resolver: zodResolver(PasswordResetSchema),
    defaultValues: {
      password: '',
      confirm_password: '',
    },
  });

  const onSubmit = async (values: PasswordResetValues) => {
    await runPending(
      () =>
        authLifecycle.completePasswordReset(
          {
            verifyToken: searchParams.get('token'),
            password: values.password,
            confirmPassword: values.confirm_password,
          },
          {
            navigate: (href) => router.push(href),
            toast,
          }
        ),
      { keepPendingWhen: (result) => result.ok }
    );
  };

  return { form, isSubmitting, onSubmit };
}
