import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { useToast } from '@/components/ui/use-toast';
import { authLifecycle } from '@/lib/auth/sessionLifecycle';
import { PasswordResetSchema } from '@/schemas/auth';

type PasswordResetValues = z.infer<typeof PasswordResetSchema>;

export default function usePasswordResetForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlightRef = useRef(false);
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
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsSubmitting(true);
    let redirected = false;
    try {
      const result = await authLifecycle.completePasswordReset(
        {
          verifyToken: searchParams.get('token'),
          password: values.password,
          confirmPassword: values.confirm_password,
        },
        {
          navigate: (href) => router.push(href),
          toast,
        }
      );
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
