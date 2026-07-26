import { useEffect } from 'react';
import { useFieldArray, UseFormReturn, useWatch } from 'react-hook-form';

import { ProfileFormValues } from '@/schemas/profileSchema';

export type RepeatableArrayPath = 'work_experiences' | 'educations';

export interface RepeatablePeriodConfig<K extends RepeatableArrayPath> {
  arrayName: K;
  periodStartKey: keyof ProfileFormValues[K][number] & string;
  periodEndKey: keyof ProfileFormValues[K][number] & string;
  isIncompleteForAppend: (
    last: ProfileFormValues[K][number] | undefined
  ) => boolean;
  incompleteAlertMessage: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 1940 + 1 }, (_, i) =>
  (CURRENT_YEAR - i).toString()
);

export function useRepeatablePeriodSection<K extends RepeatableArrayPath>(
  form: UseFormReturn<ProfileFormValues>,
  config: RepeatablePeriodConfig<K>,
  onValidationChange: (hasError: boolean) => void
) {
  const { control } = form;

  const { fields, append, remove, move } = useFieldArray<ProfileFormValues, K>({
    control,
    name: config.arrayName,
  });

  const watchedItems = useWatch({
    control,
    name: config.arrayName,
  }) as ProfileFormValues[K] | undefined;

  useEffect(() => {
    const hasError = (
      watchedItems as unknown as Array<Record<string, unknown>> | undefined
    )?.some((item) => {
      const start = item?.[config.periodStartKey] as string | undefined;
      const end = item?.[config.periodEndKey] as string | undefined;
      return start && end && end !== 'now' && Number(start) > Number(end);
    });
    onValidationChange(!!hasError);
  }, [
    watchedItems,
    config.periodStartKey,
    config.periodEndKey,
    onValidationChange,
  ]);

  const isInvalidPeriod = (index: number): boolean => {
    const item = (
      watchedItems as unknown as Array<Record<string, unknown>> | undefined
    )?.[index];
    if (!item) return false;
    const start = item[config.periodStartKey] as string | undefined;
    const end = item[config.periodEndKey] as string | undefined;
    return !!(start && end && end !== 'now' && Number(start) > Number(end));
  };

  const tryAppend = (defaultValue: ProfileFormValues[K][number]) => {
    const items = form.getValues(config.arrayName) ?? [];
    const last = items.at(-1);

    if (items.length > 0 && config.isIncompleteForAppend(last)) {
      alert(config.incompleteAlertMessage);
      return;
    }

    append(defaultValue as Parameters<typeof append>[0]);
  };

  return {
    fields,
    move,
    YEAR_OPTIONS,
    isInvalidPeriod,
    tryAppend,
    remove,
  };
}
