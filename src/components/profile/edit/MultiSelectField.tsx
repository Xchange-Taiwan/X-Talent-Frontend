'use client';

import { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { MultiSelect } from '@/components/ui/multi-select'; // ⬅️ 請根據實際路徑調整

interface MultiSelectFieldProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: FieldPath<T>;
  placeholder?: string;
  options: Array<{
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
  }>;
  maxCount?: number;
  animation?: number;
  variant?: 'default' | 'secondary' | 'destructive' | 'primaryAlt';
}

/**
 * Reusable field wrapper for MultiSelect with built-in validation error display
 */
export const MultiSelectField = <T extends FieldValues>({
  form,
  name,
  placeholder,
  options,
  maxCount = 3,
  animation = 0,
  variant = 'default',
}: MultiSelectFieldProps<T>) => {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <MultiSelect
              {...field}
              value={field.value || []}
              onChange={field.onChange}
              options={options}
              placeholder={placeholder}
              maxCount={maxCount}
              animation={animation}
              variant={variant}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
