import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import {
  DefaultValues,
  FieldValues,
  useForm,
  UseFormReturn,
} from 'react-hook-form';
import * as z from 'zod';

import { Form } from '@/components/ui/form';

interface ProfileStoryWrapperProps<
  TInput extends FieldValues = FieldValues,
  TOutput extends FieldValues = TInput,
> {
  schema?: z.ZodType<TOutput, TInput>;
  defaultValues: TInput;
  children: (form: UseFormReturn<TInput, unknown, TOutput>) => React.ReactNode;
}

export const ProfileStoryWrapper = <
  TInput extends FieldValues = FieldValues,
  TOutput extends FieldValues = TInput,
>({
  schema,
  defaultValues,
  children,
}: ProfileStoryWrapperProps<TInput, TOutput>) => {
  const form = useForm<TInput, unknown, TOutput>({
    resolver: schema
      ? zodResolver<TInput, unknown, TOutput>(schema)
      : undefined,
    defaultValues: defaultValues as DefaultValues<TInput>,
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
