import { zodResolver } from '@hookform/resolvers/zod';
import { SessionProvider } from 'next-auth/react';
import React, { useEffect } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import * as z from 'zod';

import { Form } from '@/components/ui/form';

interface OnboardingStoryWrapperProps<T extends z.ZodTypeAny> {
  schema: T;
  defaultValues: z.infer<T>;
  session?: import('next-auth').Session | null;
  triggerValidation?: boolean;
  children: (form: UseFormReturn<z.infer<T>>) => React.ReactNode;
}

export const OnboardingStoryWrapper = <T extends z.ZodTypeAny>({
  schema,
  defaultValues,
  session,
  triggerValidation = false,
  children,
}: OnboardingStoryWrapperProps<T>) => {
  const form = useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    if (triggerValidation) {
      form.trigger();
    }
  }, [triggerValidation, form]);

  return (
    <SessionProvider session={session}>
      <Form {...form}>
        <div className="max-w-md rounded-lg border border-border bg-background-white p-6 shadow-sm">
          {children(form)}
        </div>
      </Form>
    </SessionProvider>
  );
};
