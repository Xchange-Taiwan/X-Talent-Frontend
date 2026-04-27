'use client';

import { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';

import {
  type Category,
  CategoryMultiSelect,
} from '@/components/ui/category-multi-select';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';

interface CategoryMultiSelectFieldProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: FieldPath<T>;
  categories: Category[];
  flat?: boolean;
  maxSelected?: number;
  searchPlaceholder?: string;
}

export function CategoryMultiSelectField<T extends FieldValues>({
  form,
  name,
  categories,
  flat = false,
  maxSelected = 10,
  searchPlaceholder,
}: CategoryMultiSelectFieldProps<T>) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <CategoryMultiSelect
              flat={flat}
              categories={categories}
              value={(field.value as string[]) ?? []}
              onChange={field.onChange}
              maxSelected={maxSelected}
              searchPlaceholder={searchPlaceholder ?? '搜尋'}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
