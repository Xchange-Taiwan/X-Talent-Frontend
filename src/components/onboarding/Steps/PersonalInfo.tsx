'use client';

import { FC } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LocationType } from '@/services/user/countries';
import { IndustryType } from '@/services/user/industries';

import { totalWorkSpanOptions } from './constant';
import { step2Schema } from './index';

interface Props {
  form: ReturnType<typeof useForm<z.infer<typeof step2Schema>>>;
  locationOptions: LocationType[];
  industryOptions: IndustryType[];
}

export const PersonalInfo: FC<Props> = ({
  form,
  locationOptions,
  industryOptions,
}) => {
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="請選擇您的產業類別" />
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

        <FormField
          control={form.control}
          name="job_title"
          render={({ field }) => (
            <FormItem>
              <FormLabel showErrorStyle={false}>職稱 (選填)</FormLabel>
              <FormControl>
                <Input placeholder="請填入您的職稱" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="company"
          render={({ field }) => (
            <FormItem>
              <FormLabel showErrorStyle={false}>公司名稱 (選填) </FormLabel>
              <FormControl>
                <Input placeholder="請填入您的公司名稱" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );
};
