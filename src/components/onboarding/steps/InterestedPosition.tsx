'use client';

import { FC } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { groupAsPlaceholderCategories } from '@/lib/profile/categoryGrouping';
import { cn } from '@/lib/utils';
import { InterestVO } from '@/services/profile/interests';

import { GroupedSelections } from './GroupedSelections';
import { step3Schema } from './index';

interface Props {
  form: ReturnType<typeof useForm<z.infer<typeof step3Schema>>>;
  interestedPositionOptions: InterestVO[];
}

export const InterestedPosition: FC<Props> = ({
  form,
  interestedPositionOptions,
}) => {
  const categories = groupAsPlaceholderCategories(interestedPositionOptions);

  return (
    <FormField
      control={form.control}
      name="interested_positions"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <GroupedSelections
              categories={categories}
              value={field.value ?? []}
              onChange={field.onChange}
              maxSelected={10}
              layoutClass="flex flex-wrap gap-3"
              renderItem={(opt, { checked, disabled, onToggle }) => (
                <button
                  type="button"
                  onClick={onToggle}
                  disabled={disabled}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm transition',
                    checked
                      ? 'border-primary bg-secondary text-text-primary'
                      : 'border-gray-200 text-text-primary hover:border-primary',
                    disabled &&
                      'cursor-not-allowed opacity-50 hover:border-gray-200'
                  )}
                >
                  {opt.label}
                </button>
              )}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
