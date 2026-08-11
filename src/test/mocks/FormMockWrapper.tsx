import React from 'react';
import { FieldValues, Path, useForm, UseFormProps } from 'react-hook-form';

import { Form, FormField, FormItem } from '@/components/ui/form';

interface FormMockWrapperProps<TFieldValues extends FieldValues = FieldValues> {
  children: React.ReactNode;
  defaultValues: UseFormProps<TFieldValues>['defaultValues'];
  fieldName: Path<TFieldValues>;
}

export const FormMockWrapper = <
  TFieldValues extends FieldValues = FieldValues,
>({
  children,
  defaultValues,
  fieldName,
}: FormMockWrapperProps<TFieldValues>) => {
  const form = useForm<TFieldValues>({
    defaultValues,
  });

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name={fieldName}
        render={() => <FormItem>{children}</FormItem>}
      />
    </Form>
  );
};

export default FormMockWrapper;
