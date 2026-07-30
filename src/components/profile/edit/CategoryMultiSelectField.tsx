'use client';

import { UseFormReturn } from 'react-hook-form';

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

interface CategoryMultiSelectFieldProps {
  form: UseFormReturn<any>;
  name: string;
  categories: Category[];
  flat?: boolean;
  maxSelected?: number;
  searchPlaceholder?: string;
}

export function CategoryMultiSelectField({
  form,
  name,
  categories,
  flat = false,
  maxSelected = 10,
  searchPlaceholder,
}: CategoryMultiSelectFieldProps) {
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
