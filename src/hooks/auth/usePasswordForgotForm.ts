import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { useToast } from '@/components/ui/use-toast';
import { authLifecycle } from '@/lib/auth/sessionLifecycle';
import { PasswordForgotSchema } from '@/schemas/auth';

type PasswordForgotValues = z.infer<typeof PasswordForgotSchema>;

export default function usePasswordForgotForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlightRef = useRef(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<PasswordForgotValues>({
    resolver: zodResolver(PasswordForgotSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: PasswordForgotValues) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsSubmitting(true);
    let redirected = false;
    try {
      const result = await authLifecycle.requestPasswordReset(values.email, {
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
