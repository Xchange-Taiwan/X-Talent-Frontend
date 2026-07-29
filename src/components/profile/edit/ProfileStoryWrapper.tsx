import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import * as z from 'zod';

import { Form } from '@/components/ui/form';

interface ProfileStoryWrapperProps<T extends z.ZodTypeAny> {
  schema?: T;
  defaultValues: z.infer<T>;
  children: (form: UseFormReturn<z.infer<T>>) => React.ReactNode;
}

export const ProfileStoryWrapper = <T extends z.ZodTypeAny>({
  schema,
  defaultValues,
  children,
}: ProfileStoryWrapperProps<T>) => {
  const form = useForm<z.infer<T>>({
    resolver: schema ? zodResolver(schema) : undefined,
    defaultValues,
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => console.log('Submit:', data))}
        className="max-w-3xl space-y-6 rounded-xl border border-background-border bg-background-white p-6 shadow-sm"
      >
        {children(form)}
        <button
          type="submit"
          className="rounded-md bg-brand-500 px-4 py-2 text-text-white transition-colors hover:bg-brand-600"
        >
          提交表單
        </button>
      </form>
    </Form>
  );
};
