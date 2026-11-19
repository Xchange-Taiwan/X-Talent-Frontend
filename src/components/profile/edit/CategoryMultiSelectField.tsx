'use client';

import { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';

import {
  type Category,
  CategoryMultiSelect,
} from '@/components/ui/category-multi-select';
import { CompactCategoryPicker } from '@/components/ui/compact-category-picker';
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
  singleSelect?: boolean;
  addLabel?: string;
  searchPlaceholder?: string;
}

export function CategoryMultiSelectField<T extends FieldValues>({
  form,
  name,
  categories,
  flat = false,
  maxSelected = 10,
  singleSelect = false,
  addLabel,
  searchPlaceholder,
}: CategoryMultiSelectFieldProps<T>) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            {addLabel ? (
              <CompactCategoryPicker
                flat={flat}
                categories={categories}
                value={(field.value as string[]) ?? []}
                onChange={field.onChange}
                maxSelected={maxSelected}
                singleSelect={singleSelect}
                addLabel={addLabel}
                searchPlaceholder={searchPlaceholder ?? '搜尋'}
              />
            ) : (
              <CategoryMultiSelect
                flat={flat}
                categories={categories}
                value={(field.value as string[]) ?? []}
                onChange={field.onChange}
                maxSelected={maxSelected}
                singleSelect={singleSelect}
                searchPlaceholder={searchPlaceholder ?? '搜尋'}
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
