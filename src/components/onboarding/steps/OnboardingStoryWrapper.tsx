import { zodResolver } from '@hookform/resolvers/zod';
import { SessionProvider } from 'next-auth/react';
import React, { useEffect } from 'react';
import {
  DefaultValues,
  FieldValues,
  Path,
  useForm,
  UseFormReturn,
} from 'react-hook-form';
import * as z from 'zod';

import { Form } from '@/components/ui/form';

interface OnboardingStoryWrapperProps<T extends z.ZodType<FieldValues>> {
  schema: T;
  defaultValues: z.infer<T>;
  session?: import('next-auth').Session | null;
  triggerValidation?: boolean;
  children: (form: UseFormReturn<z.infer<T>>) => React.ReactNode;
}

export const OnboardingStoryWrapper = <T extends z.ZodType<FieldValues>>({
  schema,
  defaultValues,
  session,
  triggerValidation = false,
  children,
}: OnboardingStoryWrapperProps<T>) => {
  const form = useForm<z.infer<T>>({
    resolver: zodResolver<z.infer<T>, unknown, z.infer<T>>(
      schema as unknown as z.ZodType<z.infer<T>, z.infer<T>>
    ),
    defaultValues: defaultValues as unknown as DefaultValues<z.infer<T>>,
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

interface OnboardingStepDemoWrapperProps<T extends z.ZodType<FieldValues>> {
  schema: T;
  fieldName: string;
  defaultValues: z.infer<T>;
  children: (form: UseFormReturn<z.infer<T>>) => React.ReactNode;
}

export const OnboardingStepDemoWrapper = <T extends z.ZodType<FieldValues>>({
  schema,
  fieldName,
  defaultValues,
  children,
}: OnboardingStepDemoWrapperProps<T>) => {
  const [submittedData, setSubmittedData] = React.useState<unknown>(null);

  return (
    <OnboardingStoryWrapper schema={schema} defaultValues={defaultValues}>
      {(form) => (
        <form
          onSubmit={form.handleSubmit((data) => setSubmittedData(data))}
          className="space-y-6"
        >
          {children(form)}

          <div className="flex gap-4">
            <button
              type="submit"
              className="rounded-lg bg-brand-500 px-4 py-2 text-text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              提交表單
            </button>
            <button
              type="button"
              onClick={() => {
                form.reset(defaultValues);
                setSubmittedData(null);
              }}
              className="rounded-lg border border-background-border px-4 py-2 text-text-secondary hover:bg-background-bottom-secondary"
            >
              重置
            </button>
          </div>

          {/* Real-time Form values */}
          <div className="mt-6 border-t pt-4 text-sm text-text-tertiary">
            <p>
              <strong>表單當前數值：</strong>
              {JSON.stringify(form.watch(fieldName as Path<z.infer<T>>))}
            </p>
            <p className="mt-1">
              <strong>表單驗證狀態：</strong>
              {form.formState.errors[fieldName] ? (
                <span className="text-status-error-default">
                  {form.formState.errors[fieldName]?.message as string}
                </span>
              ) : (
                <span className="text-status-success-default">驗證通過</span>
              )}
            </p>
            {submittedData !== null && (
              <p className="mt-2 text-brand-600">
                <strong>提交成功數據：</strong>
                {JSON.stringify(submittedData)}
              </p>
            )}
          </div>
        </form>
      )}
    </OnboardingStoryWrapper>
  );
};
