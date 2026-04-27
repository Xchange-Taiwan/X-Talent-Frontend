'use client';

import { FC } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { CategoryMultiSelect } from '@/components/ui/category-multi-select';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { flattenAsSingleCategory } from '@/lib/profile/categoryGrouping';
import { LocationType } from '@/services/profile/countries';
import { ProfessionVO } from '@/services/profile/industries';

import { totalWorkSpanOptions } from './constant';
import { step2Schema } from './index';

interface Props {
  form: ReturnType<typeof useForm<z.infer<typeof step2Schema>>>;
  locationOptions: LocationType[];
  industryOptions: ProfessionVO[];
}

export const PersonalInfo: FC<Props> = ({
  form,
  locationOptions,
  industryOptions,
}) => {
  const industryCategories = flattenAsSingleCategory(industryOptions);

  return (
    <>
      <div className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>地區</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="請填入您的所在地區" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {locationOptions.map((option) => (
                    <SelectItem
                      key={`region ${option.value}`}
                      value={option.value}
                    >
                      {option.text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="years_of_experience"
          render={({ field }) => (
            <FormItem>
              <FormLabel>經驗</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="請選擇您的年資區間" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {totalWorkSpanOptions.map((option) => (
                    <SelectItem
                      key={`totalWorkSpan ${option.value}`}
                      value={option.value}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="industry"
          render={({ field }) => (
            <FormItem>
              <FormLabel>產業 (選填)</FormLabel>
              <FormControl>
                <CategoryMultiSelect
                  flat
                  categories={industryCategories}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  maxSelected={10}
                  searchPlaceholder="搜尋產業"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );
};
