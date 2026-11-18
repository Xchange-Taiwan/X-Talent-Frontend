import { useCallback, useEffect, useRef, useState } from 'react';
import { useFieldArray } from 'react-hook-form';

import { useToast } from '@/components/ui/use-toast';
import { ProfileFormContext } from '@/hooks/user/profile/useProfileEditorSession';
import { ProfileFormInput, ProfileFormValues } from '@/schemas/profileSchema';

export type RepeatableArrayPath = 'work_experiences' | 'educations';

export interface RepeatablePeriodConfig<K extends RepeatableArrayPath> {
  arrayName: K;
  isIncompleteForAppend: (
    last: ProfileFormValues[K][number] | undefined
  ) => boolean;
  incompleteAlertMessage: string;
  collapsible?: boolean;
}

export function formatPeriodRangeLabel(start?: string, end?: string): string {
  const startText = start || '?';
  const endText = end === 'now' ? '至今' : end || '?';
  return `${startText} – ${endText}`;
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
  const {
    control,
    formState: { errors, submitCount },
  } = form;
  const { toast } = useToast();
  const collapsible = Boolean(config.collapsible);

  const { fields, append, remove, move } = useFieldArray<ProfileFormInput, K>({
    control,
    name: config.arrayName,
  });

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const pendingExpandLastRef = useRef(false);

  const arrayErrors = errors[config.arrayName];

  useEffect(() => {
    if (!collapsible || !pendingExpandLastRef.current || fields.length === 0) {
      return;
    }
    pendingExpandLastRef.current = false;
    const newestId = fields[fields.length - 1]?.id;
    if (newestId) {
      setExpandedIds((prev) => ({ ...prev, [newestId]: true }));
    }
  }, [collapsible, fields]);

  useEffect(() => {
    if (!collapsible || !Array.isArray(arrayErrors)) return;
    const idsToOpen: string[] = [];
    arrayErrors.forEach((entryErr, idx) => {
      if (entryErr && fields[idx]?.id) {
        idsToOpen.push(fields[idx].id);
      }
    });
    if (idsToOpen.length > 0) {
      setExpandedIds((prev) => {
        const next = { ...prev };
        for (const id of idsToOpen) next[id] = true;
        return next;
      });
    }
  }, [arrayErrors, collapsible, fields, submitCount]);

  const toggleExpand = useCallback((fieldId: string) => {
    setExpandedIds((prev) => ({ ...prev, [fieldId]: !prev[fieldId] }));
  }, []);

  const isRowExpanded = useCallback(
    (fieldId: string) => !collapsible || Boolean(expandedIds[fieldId]),
    [collapsible, expandedIds]
  );

  const hasRowError = useCallback(
    (index: number) =>
      Boolean(Array.isArray(arrayErrors) && arrayErrors[index]),
    [arrayErrors]
  );

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

    if (collapsible) {
      pendingExpandLastRef.current = true;
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
    toggleExpand,
    isRowExpanded,
    hasRowError,
  };
}
