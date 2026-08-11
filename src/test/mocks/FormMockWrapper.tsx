import React from 'react';
import { FieldValues, useForm, UseFormProps } from 'react-hook-form';

import { Form, FormField, FormItem } from '@/components/ui/form';

interface FormMockWrapperProps<TFieldValues extends FieldValues = FieldValues> {
  children: React.ReactNode;
  defaultValues?: UseFormProps<TFieldValues>['defaultValues'];
  fieldName?: string;
}

export const FormMockWrapper = <
  TFieldValues extends FieldValues = FieldValues,
>({
  children,
  defaultValues = { password: '' } as any,
  fieldName = 'password',
}: FormMockWrapperProps<TFieldValues>) => {
  const form = useForm<TFieldValues>({
    defaultValues,
  });

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name={fieldName as any}
        render={() => <FormItem>{children}</FormItem>}
      />
    </Form>
  );
};

export default FormMockWrapper;
