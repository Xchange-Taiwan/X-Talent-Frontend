import { useEffect } from 'react';
import { useFieldArray, useWatch } from 'react-hook-form';

import { useToast } from '@/components/ui/use-toast';
import {
  ProfileFormContext,
  ProfileFormInput,
  ProfileFormValues,
} from '@/schemas/profileSchema';

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
export const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - 1940 + 1 },
  (_, i) => (CURRENT_YEAR - i).toString()
);

const checkIsInvalid = (
  start: string | undefined,
  end: string | undefined
): boolean => {
  return !!(start && end && end !== 'now' && Number(start) > Number(end));
};

const getPeriodString = (item: unknown, key: string): string | undefined => {
  if (item && typeof item === 'object' && key in item) {
    const val = (item as Record<string, unknown>)[key];
    return typeof val === 'string' ? val : undefined;
  }
  return undefined;
};

export function useRepeatablePeriodSection<K extends RepeatableArrayPath>(
  form: ProfileFormContext,
  config: RepeatablePeriodConfig<K>,
  onValidationChange: (hasError: boolean) => void
) {
  const { control } = form;
  const { toast } = useToast();

  const { fields, append, remove, move } = useFieldArray<ProfileFormInput, K>({
    control,
    name: config.arrayName,
  });

  const watchedItems = useWatch({
    control,
    name: config.arrayName,
  }) as ProfileFormValues[K] | undefined;

  useEffect(() => {
    let hasError = false;
    if (watchedItems) {
      for (const item of watchedItems) {
        const start = getPeriodString(item, config.periodStartKey);
        const end = getPeriodString(item, config.periodEndKey);
        if (checkIsInvalid(start, end)) {
          hasError = true;
          break;
        }
      }
    }
    onValidationChange(hasError);
  }, [
    watchedItems,
    config.periodStartKey,
    config.periodEndKey,
    onValidationChange,
  ]);

  const isInvalidPeriod = (index: number): boolean => {
    const item = watchedItems?.[index];
    if (!item) return false;
    const start = getPeriodString(item, config.periodStartKey);
    const end = getPeriodString(item, config.periodEndKey);
    return checkIsInvalid(start, end);
  };

  const tryAppend = (defaultValue: ProfileFormValues[K][number]) => {
    const items = form.getValues(config.arrayName) ?? [];
    const last = items.at(-1);

    if (items.length > 0 && config.isIncompleteForAppend(last)) {
      toast({
        variant: 'destructive',
        description: config.incompleteAlertMessage,
      });
      return;
    }

    append(defaultValue as Parameters<typeof append>[0]);
  };

  return {
    fields,
    move,
    isInvalidPeriod,
    tryAppend,
    remove,
  };
}
