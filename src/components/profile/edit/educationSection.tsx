'use client';

import { PlusIcon } from '@radix-ui/react-icons';
import React from 'react';
import { UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
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

import { ProfileFormValues } from './profileSchema';
import { Section } from './section';

interface Props {
  form: UseFormReturn<ProfileFormValues>;
}

export const EducationSection = ({ form }: Props) => (
  <Section title="教育">
    {/* Major & School */}
    <div className="mb-6 gap-6 md:flex">
      <FormField
        control={form.control}
        name="subject"
        render={({ field }) => (
          <FormItem className="mb-4 grow md:mb-0">
            <FormLabel>主修</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="school"
        render={({ field }) => (
          <FormItem className="grow">
            <FormLabel>學校名稱</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>

    {/* Period & Location */}
    <div className="mb-6 gap-6 md:flex">
      {/* Period */}
      <div className="gap-2 md:flex md:basis-1/2">
        <FormField
          control={form.control}
          name="educationPeriodStart"
          render={({ field }) => (
            <FormItem className="mb-4 grow basis-1/2 md:mb-0">
              <FormLabel>開始年份</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={String(field.value ?? '')}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="請選擇年份" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <p className="relative bottom-[-8px] mx-2 my-auto hidden text-center md:block">
          ～
        </p>
        <p className="relative bottom-[-8px] mx-2 my-auto text-center text-sm md:hidden">
          至
        </p>
        <FormField
          control={form.control}
          name="educationPeriodEnd"
          render={({ field }) => (
            <FormItem className="grow basis-1/2">
              <FormLabel className="invisible md:visible">&nbsp;</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={String(field.value ?? '')}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="至今" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="now">至今</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Location */}
      <FormField
        control={form.control}
        name="educationLocation"
        render={({ field }) => (
          <FormItem className="grow md:basis-1/2">
            <FormLabel>地點</FormLabel>
            <Select
              onValueChange={field.onChange}
              defaultValue={String(field.value ?? '')}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="請填入您的地點" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="台北">台北</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>

    <Button variant="ghost" className="rounded-full px-4 py-3 text-brand-500">
      <PlusIcon className="mr-2 h-5 w-5" />
      新增
    </Button>
  </Section>
);
