'use client';

import { FC, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

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
import { step4Schema } from './index';

interface Props {
  form: ReturnType<typeof useForm<z.infer<typeof step4Schema>>>;
  wantSkillGroups: TagCatalogGroupVO[];
}

export const SkillsToImprove: FC<Props> = ({ form, wantSkillGroups }) => {
  const categories = useMemo(
    () => tagGroupsToCategories(wantSkillGroups),
    [wantSkillGroups]
  );

  return (
    <FormField
      control={form.control}
      name="want_skill"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <GroupedSelections
              categories={categories}
              value={field.value ?? []}
              onChange={field.onChange}
              maxSelected={10}
              layoutClass="grid grid-cols-1 gap-4 sm:grid-cols-2"
              renderItem={(opt, { checked, disabled, onToggle }) => (
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3',
                    checked ? 'border-primary bg-secondary' : 'border-gray-200',
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
};
