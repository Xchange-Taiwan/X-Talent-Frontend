'use client';

import { useMemo } from 'react';
import { Control, FieldValues, Path } from 'react-hook-form';

import { Checkbox } from '@/components/ui/checkbox';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { tagGroupsToCategories } from '@/lib/profile/categoryGrouping';
import { cn } from '@/lib/utils';
import { TagCatalogGroupVO } from '@/services/profile/tagCatalog';

import { GroupedSelections } from './GroupedSelections';

interface TagMultiSelectProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  groups: TagCatalogGroupVO[];
  maxSelected?: number;
}

export function TagMultiSelect<TFieldValues extends FieldValues>({
  control,
  name,
  groups,
  maxSelected = 10,
}: TagMultiSelectProps<TFieldValues>) {
  const categories = useMemo(() => tagGroupsToCategories(groups), [groups]);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <GroupedSelections
              categories={categories}
              value={(field.value as string[]) ?? []}
              onChange={field.onChange}
              maxSelected={maxSelected}
              layoutClass="grid grid-cols-1 gap-4 sm:grid-cols-2"
              renderItem={(opt, { checked, disabled, onToggle }) => (
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border p-3',
                    checked
                      ? 'border-brand-500 bg-background-bottom'
                      : 'border-background-border',
                    disabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={onToggle}
                  />
                  <span className="text-base text-text-primary">
                    {opt.label}
                  </span>
                </label>
              )}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
