'use client';

import type { Control, FieldValues, Path } from 'react-hook-form';

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
import { totalWorkSpanOptions } from '@/constant/seniority';
import { LocationType } from '@/types/location';
import { type IndustryOption } from '@/types/tagCatalog';

interface PersonalInfoFormFields extends FieldValues {
  location: string;
  years_of_experience: string;
  industry?: string;
}

interface Props<T extends PersonalInfoFormFields> {
  form: { control: Control<T> };
  locationOptions: LocationType[];
  industryOptions: IndustryOption[];
}

export const PersonalInfo = <T extends PersonalInfoFormFields>({
  form,
  locationOptions,
  industryOptions,
}: Props<T>) => {
  return (
    <>
      <div className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name={'location' as Path<T>}
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
          name={'years_of_experience' as Path<T>}
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
          name={'industry' as Path<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>產業 (選填)</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value ?? ''}
                defaultValue={field.value ?? ''}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="請選擇您的產業" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {industryOptions.map((option) => (
                    <SelectItem
                      key={`industry ${option.subject_group}`}
                      value={option.subject_group}
                    >
                      {option.subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );
};
