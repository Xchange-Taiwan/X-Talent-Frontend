import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import * as z from 'zod';

import { Form } from '@/components/ui/form';

interface ProfileStoryWrapperProps<T extends z.ZodTypeAny> {
  schema?: T;
  defaultValues: z.input<T>;
  children: (
    form: UseFormReturn<z.input<T>, unknown, z.infer<T>>
  ) => React.ReactNode;
}

export const ProfileStoryWrapper = <T extends z.ZodTypeAny>({
  schema,
  defaultValues,
  children,
}: ProfileStoryWrapperProps<T>) => {
  const form = useForm<z.input<T>, unknown, z.infer<T>>({
    resolver: schema
      ? zodResolver<z.input<T>, unknown, z.infer<T>>(schema)
      : undefined,
    defaultValues,
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => console.log('Submit:', data))}
        className="border-background-border bg-background-white max-w-3xl space-y-6 rounded-xl border p-6 shadow-sm"
      >
        {children(form)}
        <button
          type="submit"
          className="bg-brand-500 text-text-white hover:bg-brand-600 rounded-md px-4 py-2 transition-colors"
        >
          提交表單
        </button>
      </form>
    </Form>
  );
};
