import { useEffect } from 'react';
import {
  FieldPath,
  useFieldArray,
  UseFormReturn,
  useWatch,
} from 'react-hook-form';

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

const checkIsInvalid = (
  start: string | undefined,
  end: string | undefined
): boolean => {
  return !!(start && end && end !== 'now' && Number(start) > Number(end));
};

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

  // Optimize re-renders by only watching start and end keys of the items
  const watchPaths = fields.flatMap((_, index) => [
    `${config.arrayName}.${index}.${config.periodStartKey}`,
    `${config.arrayName}.${index}.${config.periodEndKey}`,
  ]);

  const watchedValues = useWatch({
    control,
    name: watchPaths as unknown as readonly FieldPath<ProfileFormValues>[],
  }) as string[] | undefined;

  useEffect(() => {
    let hasError = false;
    for (let i = 0; i < fields.length; i++) {
      const start = watchedValues?.[i * 2];
      const end = watchedValues?.[i * 2 + 1];
      if (checkIsInvalid(start, end)) {
        hasError = true;
        break;
      }
    }
    onValidationChange(hasError);
  }, [watchedValues, fields.length, onValidationChange]);

  const isInvalidPeriod = (index: number): boolean => {
    if (!watchedValues) return false;
    const start = watchedValues[index * 2];
    const end = watchedValues[index * 2 + 1];
    return checkIsInvalid(start, end);
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
