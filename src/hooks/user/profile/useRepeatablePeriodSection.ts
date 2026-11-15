import { useFieldArray } from 'react-hook-form';

import { useToast } from '@/components/ui/use-toast';
import { ProfileFormContext } from '@/hooks/user/profile/useEditProfileForm';
import { ProfileFormInput, ProfileFormValues } from '@/schemas/profileSchema';

export type RepeatableArrayPath = 'work_experiences' | 'educations';

export interface RepeatablePeriodConfig<K extends RepeatableArrayPath> {
  arrayName: K;
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

type PeriodEndPath =
  | `work_experiences.${number}.job_period_end`
  | `educations.${number}.education_period_end`;

function getPeriodEndPath(
  arrayName: RepeatableArrayPath,
  index: number
): PeriodEndPath {
  return arrayName === 'work_experiences'
    ? `work_experiences.${index}.job_period_end`
    : `educations.${index}.education_period_end`;
}

export function useRepeatablePeriodSection<K extends RepeatableArrayPath>(
  form: ProfileFormContext,
  config: RepeatablePeriodConfig<K>
) {
  const { control } = form;
  const { toast } = useToast();

  const { fields, append, remove, move } = useFieldArray<ProfileFormInput, K>({
    control,
    name: config.arrayName,
  });

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

  const createPeriodChangeHandlers = (index: number) => {
    const endPath = getPeriodEndPath(config.arrayName, index);

    return {
      handleStartYearChange:
        (onChange: (value: string) => void) => (value: string) => {
          onChange(value);
          if (form.getValues(endPath)) {
            void form.trigger(endPath);
          }
        },
      handleEndYearChange:
        (onChange: (value: string) => void) => (value: string) => {
          onChange(value);
          void form.trigger(endPath);
        },
    };
  };

  return {
    fields,
    move,
    tryAppend,
    remove,
    createPeriodChangeHandlers,
  };
}
