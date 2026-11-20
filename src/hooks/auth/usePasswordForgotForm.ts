import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { useToast } from '@/components/ui/use-toast';
import { authLifecycle } from '@/lib/auth/sessionLifecycle';
import { PasswordForgotSchema } from '@/schemas/auth';

import { useAuthPendingAction } from './useAuthPendingAction';

type PasswordForgotValues = z.infer<typeof PasswordForgotSchema>;

export default function usePasswordForgotForm() {
  const { isPending: isSubmitting, runPending } = useAuthPendingAction();
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<PasswordForgotValues>({
    resolver: zodResolver(PasswordForgotSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: PasswordForgotValues) => {
    await runPending(
      () =>
        authLifecycle.requestPasswordReset(values.email, {
          navigate: (href) => router.push(href),
          toast,
        }),
      { keepPendingWhen: (result) => result.ok }
    );
  };

  return { form, isSubmitting, onSubmit };
}
